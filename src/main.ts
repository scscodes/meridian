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
import { createChatDomain } from "./domains/chat/service";
import { createWorkflowDomain } from "./domains/workflow/service";
import { createAgentDomain } from "./domains/agent/service";
import {
  createObservabilityMiddleware,
  createAuditMiddleware,
} from "./cross-cutting/middleware";
import { StepRunner } from "./infrastructure/workflow-engine";
import { createGitProvider } from "./infrastructure/git-provider";
import { createWorkspaceProvider } from "./infrastructure/workspace-provider";
import {
  TelemetryTracker,
  ConsoleTelemetrySink,
} from "./infrastructure/telemetry";
import { createChatParticipant } from "./ui/chat-participant";
import { createSmartCommitApprovalUI } from "./ui/smart-commit-quick-pick";
import { registerMeridianTools } from "./ui/lm-tools";
import { generateProse } from "./infrastructure/prose-generator";
import { Config } from "./infrastructure/config";

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
  const extensionPath = context.extensionUri.fsPath;
  const gitProvider = createGitProvider(workspaceRoot);
  const workspaceProvider = createWorkspaceProvider(workspaceRoot, logger);

  // ── Router + middleware ─────────────────────────────────────────────
  const router = new CommandRouter(logger);
  router.use(createObservabilityMiddleware(logger, telemetry));
  router.use(createAuditMiddleware(logger));

  const stepRunner: StepRunner = async (command: Command, ctx: CommandContext) => {
    const result = await router.dispatch(command, ctx);
    if (result.kind === "ok") {
      return { kind: "ok" as const, value: (result.value as Record<string, unknown>) || {} };
    }
    return result as any;
  };

  // ── Domain registration ─────────────────────────────────────────────
  const smartCommitApprovalUI = createSmartCommitApprovalUI();
  router.registerDomain(createGitDomain(gitProvider, logger, workspaceRoot, smartCommitApprovalUI, generateProse));
  router.registerDomain(createHygieneDomain(workspaceProvider, logger, workspaceRoot, generateProse));
  router.registerDomain(createChatDomain(gitProvider, logger, (cmd, ctx) => router.dispatch(cmd, ctx), generateProse));
  router.registerDomain(createWorkflowDomain(logger, stepRunner, workspaceRoot, extensionPath));
  router.registerDomain(createAgentDomain(logger, workspaceRoot, extensionPath, (cmd, ctx) => router.dispatch(cmd, ctx)));

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

  const { analyticsPanel, hygieneAnalyticsPanel } = createWebviewPanels(
    context, router, workspaceRoot, ctxFn, () => config.getPruneConfig()
  );

  registerCommands(context, router, outputChannel, ctxFn, () => config.getPruneConfig(), {
    outputChannel, analyticsPanel, hygieneAnalyticsPanel,
  });

  registerSpecializedCommands(context, router, outputChannel, ctxFn, trees.workflowTree, trees.hygieneTree);

  const statusBar = setupStatusBar(context, gitProvider, () => {
    trees.gitTree.refresh();
    trees.hygieneTree.refresh();
    trees.workflowTree.refresh();
    trees.agentTree.refresh();
  });

  setupFileWatchers(context, workspaceRoot, {
    gitRefresh: () => trees.gitTree.refresh(),
    hygieneRefresh: () => trees.hygieneTree.refresh(),
    definitionsRefresh: () => { trees.workflowTree.refresh(); trees.agentTree.refresh(); },
    statusBarUpdate: () => statusBar.update(),
  });

  // ── Chat + LM tools ────────────────────────────────────────────────
  context.subscriptions.push(createChatParticipant(router, cmdCtx, logger));
  context.subscriptions.push(...registerMeridianTools(router, cmdCtx, logger));

  // ── Finalize ────────────────────────────────────────────────────────
  statusBar.update();

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
