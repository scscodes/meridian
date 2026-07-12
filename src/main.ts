/**
 * VS Code Extension Entry Point
 * Activates domains, registers commands, sets up middleware.
 */

import * as vscode from "vscode";
import { CommandRouter } from "./router";
import { Logger } from "./infrastructure/logger";
import { CommandContext, Command } from "./types";
import { createGitDomain } from "./domains/git/service";
import { createHygieneDomain } from "./domains/hygiene/service";
import {
  createObservabilityMiddleware,
  createAuditMiddleware,
} from "./cross-cutting/middleware";
import { createGitProvider } from "./infrastructure/git-provider";
import { createWorkspaceProvider } from "./infrastructure/workspace-provider";
import {
  TelemetryTracker,
  ConsoleTelemetrySink,
} from "./infrastructure/telemetry";
import { generateProse } from "./infrastructure/prose-generator";
import { readSetting, setWorkspaceSettingsDiagnosticsListener } from "./infrastructure/settings";
import { getPruneConfig } from "./domains/hygiene/prune-config";
import { createRunLog } from "./infrastructure/run-log";
import { createPulseStore } from "./infrastructure/pulse-store";
import { setLatestSnapshotRepoContextProvider } from "./infrastructure/latest-snapshot";
import { runActivationRetention } from "./infrastructure/retention";
import { migrateLegacyIgnoreFile } from "./infrastructure/dotdir-migration";
import { isSensitiveLoggingEnabled, sanitizeForLogs } from "./security/operation-policy";

// Presentation layer
import { registerCommands, COMMAND_MAP } from "./presentation/command-registry";
import { setupStatusBar } from "./presentation/status-bar";
import { setupFileWatchers } from "./presentation/file-watchers";
import { setupTreeProviders } from "./presentation/tree-setup";
import { registerSpecializedCommands } from "./presentation/specialized-commands";
import { registerLatestRefreshCommand } from "./presentation/latest-refresh";
import { createWebviewPanels } from "./presentation/webview-setup";

// ============================================================================
// Command Context Builder
// ============================================================================

function getCommandContext(context: vscode.ExtensionContext): CommandContext {
  return {
    extensionPath: context.extensionUri.fsPath,
    workspaceFolders:
      vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) ?? [],
    activeFilePath:
      vscode.window.activeTextEditor?.document.uri.fsPath,
  };
}

// ============================================================================
// Extension Activation
// ============================================================================

export async function activate(context: vscode.ExtensionContext): Promise<void> {

  // ── Infrastructure ──────────────────────────────────────────────────
  const logger = new Logger();
  const outputChannel = vscode.window.createOutputChannel("Meridian");
  context.subscriptions.push(outputChannel);

  // Surface .meridian/settings.json misconfigurations — a typo'd key or
  // mis-typed value falls through silently by contract (ADR 014), so report
  // it once per file change in the output channel instead of never.
  setWorkspaceSettingsDiagnosticsListener((diagnostics, file) => {
    const parts: string[] = [];
    if (diagnostics.parseError) parts.push(`parse error: ${diagnostics.parseError}`);
    if (diagnostics.unknownKeys.length > 0) parts.push(`unknown key(s): ${diagnostics.unknownKeys.join(", ")}`);
    if (diagnostics.mismatchedKeys.length > 0) parts.push(`wrong value type, ignored: ${diagnostics.mismatchedKeys.join(", ")}`);
    const message = `${file} — ${parts.join("; ")}`;
    logger.warn(message, "settings");
    outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
  });
  context.subscriptions.push({ dispose: () => setWorkspaceSettingsDiagnosticsListener(null) });

  const telemetry = new TelemetryTracker(new ConsoleTelemetrySink(false));
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const workspaceRoot = workspaceFolder ?? process.cwd();

  // ADR 014: hoist legacy .meridianignore into .meridian/ before any analyzer
  // warms its cache against the new location. No-op when no workspace folder
  // is open — never migrate inside an arbitrary cwd.
  migrateLegacyIgnoreFile(workspaceFolder, logger);

  const gitProvider = createGitProvider(workspaceRoot);
  // Trash-first deletion: hygiene's user-facing Delete File stays recoverable
  // from the OS trash; the provider falls back to a permanent unlink where
  // the host filesystem has no trash.
  const workspaceProvider = createWorkspaceProvider(workspaceRoot, logger, (absolutePath) =>
    Promise.resolve(
      vscode.workspace.fs.delete(vscode.Uri.file(absolutePath), { recursive: false, useTrash: true })
    )
  );

  // ADR 020 addendum: every latest-snapshot write stamps a `repo` staleness
  // fingerprint resolved through the GitProvider (the only place that shells
  // git). All-or-nothing: any failed lookup (e.g. non-git workspace) omits
  // the field rather than writing a partial fingerprint.
  setLatestSnapshotRepoContextProvider(async () => {
    const [status, head] = await Promise.all([gitProvider.status(), gitProvider.getHeadCommit()]);
    if (status.kind !== "ok" || head.kind !== "ok") return null;
    const { branch, isDirty, staged, unstaged, untracked } = status.value;
    return { branch, head: head.value, isDirty, staged, unstaged, untracked };
  });
  context.subscriptions.push({ dispose: () => setLatestSnapshotRepoContextProvider(null) });
  const runLog = createRunLog(workspaceRoot, logger);
  // Pulse history writes into .meridian/ — only when a real workspace folder
  // is open, never inside an arbitrary cwd (same guard as the ADR 014 migration).
  const pulseStore = workspaceFolder ? createPulseStore(workspaceFolder, logger) : undefined;

  // ── Router + middleware ─────────────────────────────────────────────
  // security.logging.sensitive (default "redact"): error text is redacted
  // before it is persisted to the run-log unless the user opts into raw logs.
  const router = new CommandRouter(logger, runLog, (text) =>
    isSensitiveLoggingEnabled() ? text : sanitizeForLogs(text)
  );
  router.use(createObservabilityMiddleware(logger, telemetry));
  router.use(createAuditMiddleware(logger));

  // ── Domain registration ─────────────────────────────────────────────
  // Pass the raw (possibly undefined) folder, not the cwd fallback: the
  // hygiene background scan must never crawl an arbitrary cwd when no
  // workspace is open. The service skips its timer when root is undefined —
  // and the storage handlers then fail with WORKSPACE_NOT_FOUND (ADR 019).
  const hygieneDomain = createHygieneDomain(workspaceProvider, logger, workspaceFolder, generateProse, runLog);
  const gitDomain = createGitDomain(
    gitProvider, logger, workspaceRoot, generateProse,
    runLog, () => hygieneDomain.getLastScan(), pulseStore
  );
  router.registerDomain(gitDomain);
  router.registerDomain(hygieneDomain);

  const validationResult = await router.validateDomains();
  if (validationResult.kind === "err") {
    logger.error("Domain validation failed", "activate", validationResult.error);
    throw new Error(validationResult.error.message);
  }

  // ── Presentation layer ──────────────────────────────────────────────
  const ctxFn = () => getCommandContext(context);
  const dispatch = (cmd: Command, ctx: CommandContext) => router.dispatch(cmd, ctx);
  const cmdCtx = getCommandContext(context);

  // Wire analyzer cache invalidators to webview providers so the right-click
  // "Ignore" action drops stale entries before the post-write refresh.
  const { analyticsPanel, hygieneAnalyticsPanel, sessionBriefingPanel } = createWebviewPanels(
    context, router, workspaceRoot, ctxFn, getPruneConfig,
    {
      invalidateGitAnalytics:     () => gitDomain.analyzer.clearCache(),
      invalidateHygieneAnalytics: () => hygieneDomain.analyzer.clearCache(),
    }
  );

  const trees = setupTreeProviders(
    context, gitProvider, logger, workspaceRoot, dispatch, cmdCtx,
    { analyticsPanel, hygieneAnalyticsPanel, sessionBriefingPanel }
  );

  registerCommands(context, router, outputChannel, ctxFn, getPruneConfig, {
    outputChannel, analyticsPanel, hygieneAnalyticsPanel, sessionBriefingPanel,
  });

  registerSpecializedCommands(context, router, outputChannel, ctxFn, trees.hygieneTree);

  registerLatestRefreshCommand(context, router, ctxFn, getPruneConfig, logger);

  const statusBar = setupStatusBar(context, gitProvider, () => {
    trees.gitTree.refresh();
    trees.hygieneTree.refresh();
  });

  const enableFileWatchers = readSetting("startup.enableFileWatchers");

  if (!enableFileWatchers) {
    logger.info("Startup: file watchers disabled by config", "activate");
  } else {
    setupFileWatchers(context, workspaceRoot, {
      gitRefresh: () => trees.gitTree.refresh(),
      hygieneRefresh: () => trees.hygieneTree.refresh(),
      statusBarUpdate: () => statusBar.update(),
    });
  }

  // ── Finalize ────────────────────────────────────────────────────────
  statusBar.update();

  // Retention (ADR 019): lazy, fire-and-forget self-policing of Meridian-owned
  // storage. Only with a real workspace folder — never prune inside a bare cwd.
  if (workspaceFolder) {
    void runActivationRetention(workspaceFolder, runLog, logger);
  }

  // Auto-launch session briefing if configured
  const autoLaunch = readSetting("sessionBriefing.autoLaunch");
  if (autoLaunch) {
    void vscode.commands.executeCommand("meridian.git.sessionBriefing");
  }

  logger.info(`Extension activated with ${router.listDomains().length} domains`, "activate");
  logger.info(`Registered ${COMMAND_MAP.length} commands`, "activate");
}

export async function deactivate(): Promise<void> {
  // Domain teardown happens via context.subscriptions disposal.
}

// ============================================================================
// Exports for Testing / Integration
// ============================================================================

export { CommandRouter };
export { Logger } from "./infrastructure/logger";
