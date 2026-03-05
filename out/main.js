"use strict";
/**
 * VS Code Extension Entry Point
 * Activates domains, registers commands, sets up middleware.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.CommandRouter = void 0;
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const router_1 = require("./router");
Object.defineProperty(exports, "CommandRouter", { enumerable: true, get: function () { return router_1.CommandRouter; } });
const logger_1 = require("./infrastructure/logger");
const service_1 = require("./domains/git/service");
const service_2 = require("./domains/hygiene/service");
const service_3 = require("./domains/chat/service");
const service_4 = require("./domains/workflow/service");
const service_5 = require("./domains/agent/service");
const middleware_1 = require("./cross-cutting/middleware");
const git_provider_1 = require("./infrastructure/git-provider");
const workspace_provider_1 = require("./infrastructure/workspace-provider");
const telemetry_1 = require("./infrastructure/telemetry");
const chat_participant_1 = require("./ui/chat-participant");
const smart_commit_quick_pick_1 = require("./ui/smart-commit-quick-pick");
const lm_tools_1 = require("./ui/lm-tools");
const prose_generator_1 = require("./infrastructure/prose-generator");
const analytics_types_1 = require("./domains/hygiene/analytics-types");
// Presentation layer
const command_registry_1 = require("./presentation/command-registry");
const status_bar_1 = require("./presentation/status-bar");
const file_watchers_1 = require("./presentation/file-watchers");
const tree_setup_1 = require("./presentation/tree-setup");
const specialized_commands_1 = require("./presentation/specialized-commands");
const webview_setup_1 = require("./presentation/webview-setup");
/** Read user-configured prune settings, falling back to PRUNE_DEFAULTS */
function readPruneConfig() {
    const cfg = vscode.workspace.getConfiguration("meridian.hygiene.prune");
    return {
        minAgeDays: cfg.get("minAgeDays", analytics_types_1.PRUNE_DEFAULTS.minAgeDays),
        maxSizeMB: cfg.get("maxSizeMB", analytics_types_1.PRUNE_DEFAULTS.maxSizeMB),
        minLineCount: cfg.get("minLineCount", analytics_types_1.PRUNE_DEFAULTS.minLineCount),
        categories: cfg.get("categories", analytics_types_1.PRUNE_DEFAULTS.categories),
    };
}
// ============================================================================
// Command Context Builder
// ============================================================================
function getCommandContext(context) {
    return {
        extensionPath: context.extensionUri.fsPath,
        workspaceFolders: vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) ?? [],
        activeFilePath: vscode.window.activeTextEditor?.document.uri.fsPath,
    };
}
// ============================================================================
// Extension Activation
// ============================================================================
async function activate(context) {
    // ── Infrastructure ──────────────────────────────────────────────────
    const logger = new logger_1.Logger();
    const outputChannel = vscode.window.createOutputChannel("Meridian");
    context.subscriptions.push(outputChannel);
    const telemetry = new telemetry_1.TelemetryTracker(new telemetry_1.ConsoleTelemetrySink(false));
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
    const extensionPath = context.extensionUri.fsPath;
    const gitProvider = (0, git_provider_1.createGitProvider)(workspaceRoot);
    const workspaceProvider = (0, workspace_provider_1.createWorkspaceProvider)(workspaceRoot);
    // ── Router + middleware ─────────────────────────────────────────────
    const router = new router_1.CommandRouter(logger);
    router.use((0, middleware_1.createObservabilityMiddleware)(logger, telemetry));
    router.use((0, middleware_1.createAuditMiddleware)(logger));
    const stepRunner = async (command, ctx) => {
        const result = await router.dispatch(command, ctx);
        if (result.kind === "ok") {
            return { kind: "ok", value: result.value || {} };
        }
        return result;
    };
    // ── Domain registration ─────────────────────────────────────────────
    const smartCommitApprovalUI = (0, smart_commit_quick_pick_1.createSmartCommitApprovalUI)();
    router.registerDomain((0, service_1.createGitDomain)(gitProvider, logger, workspaceRoot, smartCommitApprovalUI, prose_generator_1.generateProse));
    router.registerDomain((0, service_2.createHygieneDomain)(workspaceProvider, logger));
    router.registerDomain((0, service_3.createChatDomain)(gitProvider, logger, (cmd, ctx) => router.dispatch(cmd, ctx), prose_generator_1.generateProse));
    router.registerDomain((0, service_4.createWorkflowDomain)(logger, stepRunner, workspaceRoot, extensionPath));
    router.registerDomain((0, service_5.createAgentDomain)(logger, workspaceRoot, extensionPath, (cmd, ctx) => router.dispatch(cmd, ctx)));
    const validationResult = await router.validateDomains();
    if (validationResult.kind === "err") {
        logger.error("Domain validation failed", "activate", validationResult.error);
        throw new Error(validationResult.error.message);
    }
    // ── Presentation layer ──────────────────────────────────────────────
    const ctxFn = () => getCommandContext(context);
    const dispatch = (cmd, ctx) => router.dispatch(cmd, ctx);
    const cmdCtx = getCommandContext(context);
    const trees = (0, tree_setup_1.setupTreeProviders)(context, gitProvider, logger, workspaceRoot, dispatch, cmdCtx);
    const { analyticsPanel, hygieneAnalyticsPanel } = (0, webview_setup_1.createWebviewPanels)(context, router, workspaceRoot, ctxFn, readPruneConfig);
    (0, command_registry_1.registerCommands)(context, router, outputChannel, ctxFn, readPruneConfig, {
        outputChannel, analyticsPanel, hygieneAnalyticsPanel,
    });
    (0, specialized_commands_1.registerSpecializedCommands)(context, router, outputChannel, ctxFn, trees.workflowTree, trees.hygieneTree);
    const statusBar = (0, status_bar_1.setupStatusBar)(context, gitProvider, () => {
        trees.gitTree.refresh();
        trees.hygieneTree.refresh();
        trees.workflowTree.refresh();
        trees.agentTree.refresh();
    });
    (0, file_watchers_1.setupFileWatchers)(context, workspaceRoot, {
        gitRefresh: () => trees.gitTree.refresh(),
        hygieneRefresh: () => trees.hygieneTree.refresh(),
        definitionsRefresh: () => { trees.workflowTree.refresh(); trees.agentTree.refresh(); },
        statusBarUpdate: () => statusBar.update(),
    });
    // ── Chat + LM tools ────────────────────────────────────────────────
    context.subscriptions.push((0, chat_participant_1.createChatParticipant)(router, cmdCtx, logger));
    context.subscriptions.push(...(0, lm_tools_1.registerMeridianTools)(router, cmdCtx, logger));
    // ── Finalize ────────────────────────────────────────────────────────
    statusBar.update();
    logger.info(`Extension activated with ${router.listDomains().length} domains`, "activate");
    logger.info(`Registered ${command_registry_1.COMMAND_MAP.length} commands`, "activate");
}
async function deactivate() {
    // Domain teardown happens via context.subscriptions disposal.
}
var logger_2 = require("./infrastructure/logger");
Object.defineProperty(exports, "Logger", { enumerable: true, get: function () { return logger_2.Logger; } });
//# sourceMappingURL=main.js.map