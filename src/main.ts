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
import { Config } from "./infrastructure/config";
import { createRunLog } from "./infrastructure/run-log";

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

  const config = new Config();
  const configResult = await config.initialize();
  if (configResult.kind === "err") {
    logger.warn("Config initialization used defaults", "activate", configResult.error);
  }

  const telemetry = new TelemetryTracker(new ConsoleTelemetrySink(false));
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
  const gitProvider = createGitProvider(workspaceRoot);
  const workspaceProvider = createWorkspaceProvider(workspaceRoot, logger);
  const runLog = createRunLog(workspaceRoot, logger);

  // ── Router + middleware ─────────────────────────────────────────────
  const router = new CommandRouter(logger, runLog);
  router.use(createObservabilityMiddleware(logger, telemetry));
  router.use(createAuditMiddleware(logger));

  // ── Domain registration ─────────────────────────────────────────────
  const hygieneDomain = createHygieneDomain(workspaceProvider, logger, workspaceRoot, generateProse);
  router.registerDomain(createGitDomain(
    gitProvider, logger, workspaceRoot, generateProse,
    runLog, () => hygieneDomain.getLastScan()
  ));
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

  const trees = setupTreeProviders(context, gitProvider, logger, workspaceRoot, dispatch, cmdCtx);

  const { analyticsPanel, hygieneAnalyticsPanel, sessionBriefingPanel } = createWebviewPanels(
    context, router, workspaceRoot, ctxFn, () => config.getPruneConfig()
  );

  registerCommands(context, router, outputChannel, ctxFn, () => config.getPruneConfig(), {
    outputChannel, analyticsPanel, hygieneAnalyticsPanel, sessionBriefingPanel,
  });

  registerSpecializedCommands(context, router, outputChannel, ctxFn, trees.hygieneTree);

  const statusBar = setupStatusBar(context, gitProvider, () => {
    trees.gitTree.refresh();
    trees.hygieneTree.refresh();
  });

  const startupConfig = vscode.workspace.getConfiguration("meridian.startup");
  const enableFileWatchers = startupConfig.get<boolean>("enableFileWatchers", true);

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
  const autoLaunch = vscode.workspace.getConfiguration("meridian")
    .get<boolean>("sessionBriefing.autoLaunch", false);
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
