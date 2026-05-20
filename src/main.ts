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
import { readSetting } from "./infrastructure/settings";
import { getPruneConfig } from "./domains/hygiene/prune-config";
import { createRunLog } from "./infrastructure/run-log";
import { migrateLegacyIgnoreFile } from "./infrastructure/dotdir-migration";

// Presentation layer
import { registerCommands, COMMAND_MAP } from "./presentation/command-registry";
import { setupStatusBar } from "./presentation/status-bar";
import { setupFileWatchers } from "./presentation/file-watchers";
import { setupTreeProviders } from "./presentation/tree-setup";
import { registerSpecializedCommands } from "./presentation/specialized-commands";
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

  const telemetry = new TelemetryTracker(new ConsoleTelemetrySink(false));
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();

  // ADR 014: hoist legacy .meridianignore into .meridian/ before any analyzer
  // warms its cache against the new location.
  migrateLegacyIgnoreFile(workspaceRoot, logger);

  const gitProvider = createGitProvider(workspaceRoot);
  const workspaceProvider = createWorkspaceProvider(workspaceRoot, logger);
  const runLog = createRunLog(workspaceRoot, logger);

  // ── Router + middleware ─────────────────────────────────────────────
  const router = new CommandRouter(logger, runLog);
  router.use(createObservabilityMiddleware(logger, telemetry));
  router.use(createAuditMiddleware(logger));

  // ── Domain registration ─────────────────────────────────────────────
  const hygieneDomain = createHygieneDomain(workspaceProvider, logger, workspaceRoot, generateProse);
  const gitDomain = createGitDomain(
    gitProvider, logger, workspaceRoot, generateProse,
    runLog, () => hygieneDomain.getLastScan()
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
