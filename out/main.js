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
const fs = __importStar(require("fs"));
const nodePath = __importStar(require("path"));
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
const result_handler_1 = require("./infrastructure/result-handler");
const git_tree_provider_1 = require("./ui/tree-providers/git-tree-provider");
const hygiene_tree_provider_1 = require("./ui/tree-providers/hygiene-tree-provider");
const workflow_tree_provider_1 = require("./ui/tree-providers/workflow-tree-provider");
const agent_tree_provider_1 = require("./ui/tree-providers/agent-tree-provider");
const chat_participant_1 = require("./ui/chat-participant");
const smart_commit_quick_pick_1 = require("./ui/smart-commit-quick-pick");
const lm_tools_1 = require("./ui/lm-tools");
const webview_provider_1 = require("./infrastructure/webview-provider");
const analytics_types_1 = require("./domains/hygiene/analytics-types");
const model_selector_1 = require("./infrastructure/model-selector");
const prose_generator_1 = require("./infrastructure/prose-generator");
const constants_1 = require("./constants");
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
// Telemetry Middleware Factory
// ============================================================================
/**
 * Creates a middleware that emits COMMAND_STARTED, COMMAND_COMPLETED, and
 * COMMAND_FAILED telemetry events around each dispatched command.
 */
function createTelemetryMiddleware(telemetry) {
    return async (ctx, next) => {
        const start = Date.now();
        telemetry.trackCommandStarted(ctx.commandName);
        try {
            await next();
            telemetry.trackCommandCompleted(ctx.commandName, Date.now() - start, "success");
        }
        catch (err) {
            const duration = Date.now() - start;
            telemetry.trackCommandFailed(ctx.commandName, duration, {
                code: "MIDDLEWARE_ERROR",
                message: err instanceof Error ? err.message : String(err),
                context: ctx.commandName,
            });
            throw err;
        }
    };
}
// ============================================================================
// Command Context Builder
// ============================================================================
/**
 * Build a CommandContext from the VS Code extension context.
 * workspaceFolders maps to the first workspace folder URI if available.
 */
function getCommandContext(context) {
    return {
        extensionPath: context.extensionUri.fsPath,
        workspaceFolders: vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) ?? [],
        activeFilePath: vscode.window.activeTextEditor?.document.uri.fsPath,
    };
}
// ============================================================================
// Command ID → Internal CommandName mapping
// ============================================================================
const COMMAND_MAP = [
    ["meridian.git.status", "git.status"],
    ["meridian.git.pull", "git.pull"],
    ["meridian.git.commit", "git.commit"],
    ["meridian.git.smartCommit", "git.smartCommit"],
    ["meridian.hygiene.scan", "hygiene.scan"],
    ["meridian.hygiene.cleanup", "hygiene.cleanup"],
    ["meridian.hygiene.impactAnalysis", "hygiene.impactAnalysis"],
    ["meridian.chat.context", "chat.context"],
    ["meridian.workflow.list", "workflow.list"],
    ["meridian.agent.list", "agent.list"],
    ["meridian.agent.execute", "agent.execute"],
    ["meridian.git.showAnalytics", "git.showAnalytics"],
    ["meridian.git.exportJson", "git.exportJson"],
    ["meridian.git.exportCsv", "git.exportCsv"],
    ["meridian.hygiene.showAnalytics", "hygiene.showAnalytics"],
    ["meridian.git.generatePR", "git.generatePR"],
    ["meridian.git.reviewPR", "git.reviewPR"],
    ["meridian.git.commentPR", "git.commentPR"],
    ["meridian.git.resolveConflicts", "git.resolveConflicts"],
    ["meridian.git.sessionBriefing", "git.sessionBriefing"],
    ["meridian.chat.delegate", "chat.delegate"],
];
// ============================================================================
// Debounce Helper
// ============================================================================
function debounce(fn, ms) {
    let timer;
    return () => {
        if (timer)
            clearTimeout(timer);
        timer = setTimeout(fn, ms);
    };
}
// ============================================================================
// Extension Activation
// ============================================================================
/**
 * Activate the extension.
 * Called by VS Code when activation event is triggered.
 */
async function activate(context) {
    // Initialize infrastructure layer
    const logger = new logger_1.Logger();
    // Output channel — primary user-facing log surface
    const outputChannel = vscode.window.createOutputChannel("Meridian");
    context.subscriptions.push(outputChannel);
    // Initialize telemetry
    const telemetry = new telemetry_1.TelemetryTracker(new telemetry_1.ConsoleTelemetrySink(false));
    // Resolve workspace root from VS Code workspace folders
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
    // Resolve extension path
    const extensionPath = context.extensionUri.fsPath;
    // Initialize real providers
    const gitProvider = (0, git_provider_1.createGitProvider)(workspaceRoot);
    const workspaceProvider = (0, workspace_provider_1.createWorkspaceProvider)(workspaceRoot);
    // Create router
    const router = new router_1.CommandRouter(logger);
    // Register middleware (telemetry first, then logging, then audit)
    router.use(createTelemetryMiddleware(telemetry));
    router.use((0, middleware_1.createLoggingMiddleware)(logger));
    router.use((0, middleware_1.createAuditMiddleware)(logger));
    // Create step runner for workflow engine (allows workflows to dispatch commands)
    const stepRunner = async (command, ctx) => {
        const result = await router.dispatch(command, ctx);
        if (result.kind === "ok") {
            return { kind: "ok", value: result.value || {} };
        }
        return result;
    };
    // Register domains
    const smartCommitApprovalUI = (0, smart_commit_quick_pick_1.createSmartCommitApprovalUI)();
    const gitDomain = (0, service_1.createGitDomain)(gitProvider, logger, workspaceRoot, smartCommitApprovalUI, prose_generator_1.generateProse);
    const hygieneDomain = (0, service_2.createHygieneDomain)(workspaceProvider, logger);
    const chatDomain = (0, service_3.createChatDomain)(gitProvider, logger, (cmd, ctx) => router.dispatch(cmd, ctx), prose_generator_1.generateProse);
    const workflowDomain = (0, service_4.createWorkflowDomain)(logger, stepRunner, workspaceRoot, extensionPath);
    const agentDomain = (0, service_5.createAgentDomain)(logger, workspaceRoot, extensionPath, (cmd, ctx) => router.dispatch(cmd, ctx));
    router.registerDomain(gitDomain);
    router.registerDomain(hygieneDomain);
    router.registerDomain(chatDomain);
    router.registerDomain(workflowDomain);
    router.registerDomain(agentDomain);
    // Validate all domains
    const validationResult = await router.validateDomains();
    if (validationResult.kind === "err") {
        logger.error("Domain validation failed", "activate", validationResult.error);
        throw new Error(validationResult.error.message);
    }
    // Register sidebar tree providers
    const cmdCtx = getCommandContext(context);
    // Git analytics webview panel (full-width editor tab)
    const analyticsPanel = new webview_provider_1.AnalyticsWebviewProvider(context.extensionUri, workspaceRoot, async (opts) => {
        const freshCtx = getCommandContext(context);
        const result = await router.dispatch({ name: "git.showAnalytics", params: opts }, freshCtx);
        if (result.kind === "ok") {
            return result.value;
        }
        throw new Error(result.error?.message ?? "Analytics failed");
    });
    // Hygiene analytics webview panel
    const hygieneAnalyticsPanel = new webview_provider_1.HygieneAnalyticsWebviewProvider(context.extensionUri, async () => {
        const freshCtx = getCommandContext(context);
        const result = await router.dispatch({ name: "hygiene.showAnalytics", params: readPruneConfig() }, freshCtx);
        if (result.kind === "ok")
            return result.value;
        throw new Error(result.error?.message ?? "Hygiene analytics failed");
    });
    // Register all 10 VS Code commands. Each maps the "meridian.*" vscode ID
    // to the internal bare CommandName. Results surface via OutputChannel + notifications.
    for (const [vsCodeId, commandName] of COMMAND_MAP) {
        const disposable = vscode.commands.registerCommand(vsCodeId, async (params = {}) => {
            const cmdCtx = getCommandContext(context);
            // hygiene.showAnalytics: inject user prune config before dispatching
            if (commandName === "hygiene.showAnalytics") {
                const pruneResult = await router.dispatch({ name: "hygiene.showAnalytics", params: readPruneConfig() }, cmdCtx);
                if (pruneResult.kind === "ok") {
                    await hygieneAnalyticsPanel.openPanel(pruneResult.value);
                    outputChannel.appendLine(`[${new Date().toISOString()}] Hygiene analytics panel opened`);
                }
                else {
                    const { message } = (0, result_handler_1.formatResultMessage)(commandName, pruneResult);
                    vscode.window.showErrorMessage(message);
                }
                return;
            }
            const command = { name: commandName, params };
            const result = await router.dispatch(command, cmdCtx);
            // git.showAnalytics opens the webview panel instead of a notification
            if (commandName === "git.showAnalytics" && result.kind === "ok") {
                await analyticsPanel.openPanel(result.value);
                outputChannel.appendLine(`[${new Date().toISOString()}] Analytics panel opened`);
                return;
            }
            // git.generatePR copies to clipboard and shows in OutputChannel
            if (commandName === "git.generatePR" && result.kind === "ok") {
                const pr = result.value;
                outputChannel.show(true);
                outputChannel.appendLine(`\n${"─".repeat(60)}`);
                outputChannel.appendLine(`[${new Date().toISOString()}] PR Description: ${pr.branch}`);
                outputChannel.appendLine("─".repeat(60));
                outputChannel.appendLine(pr.body);
                outputChannel.appendLine("");
                await vscode.env.clipboard.writeText(pr.body);
                vscode.window.showInformationMessage(`PR description copied to clipboard (${pr.branch})`);
                return;
            }
            // git.reviewPR — show review in OutputChannel + copy to clipboard
            if (commandName === "git.reviewPR" && result.kind === "ok") {
                const rv = result.value;
                outputChannel.show(true);
                outputChannel.appendLine(`\n${"─".repeat(60)}`);
                outputChannel.appendLine(`[${new Date().toISOString()}] PR Review: ${rv.branch} — ${rv.verdict}`);
                outputChannel.appendLine("─".repeat(60));
                outputChannel.appendLine(`\n${rv.summary}\n`);
                for (const c of rv.comments ?? []) {
                    outputChannel.appendLine(`[${c.severity}] ${c.file}: ${c.comment}`);
                }
                outputChannel.appendLine("");
                const text = `${rv.summary}\n\n${(rv.comments ?? []).map((c) => `[${c.severity}] ${c.file}: ${c.comment}`).join("\n")}`;
                await vscode.env.clipboard.writeText(text);
                vscode.window.showInformationMessage(`PR review copied to clipboard (${rv.branch}: ${rv.verdict})`);
                return;
            }
            // git.commentPR — show inline comments in OutputChannel + copy to clipboard
            if (commandName === "git.commentPR" && result.kind === "ok") {
                const cm = result.value;
                outputChannel.show(true);
                outputChannel.appendLine(`\n${"─".repeat(60)}`);
                outputChannel.appendLine(`[${new Date().toISOString()}] PR Comments: ${cm.branch} — ${cm.comments?.length ?? 0} comment(s)`);
                outputChannel.appendLine("─".repeat(60));
                for (const c of cm.comments ?? []) {
                    const loc = c.line ? `:${c.line}` : "";
                    outputChannel.appendLine(`${c.file}${loc}: ${c.comment}`);
                }
                outputChannel.appendLine("");
                const text = (cm.comments ?? []).map((c) => `${c.file}${c.line ? `:${c.line}` : ""}: ${c.comment}`).join("\n");
                await vscode.env.clipboard.writeText(text);
                vscode.window.showInformationMessage(`${cm.comments?.length ?? 0} PR comment(s) copied to clipboard`);
                return;
            }
            // git.sessionBriefing — show in OutputChannel + copy to clipboard
            if (commandName === "git.sessionBriefing" && result.kind === "ok") {
                const text = result.value;
                outputChannel.show(true);
                outputChannel.appendLine(`\n${"─".repeat(60)}`);
                outputChannel.appendLine(`[${new Date().toISOString()}] Session Briefing`);
                outputChannel.appendLine("─".repeat(60));
                outputChannel.appendLine(text);
                outputChannel.appendLine("");
                await vscode.env.clipboard.writeText(text);
                vscode.window.showInformationMessage("Session briefing copied to clipboard");
                return;
            }
            // git.resolveConflicts — show resolution prose in OutputChannel
            if (commandName === "git.resolveConflicts" && result.kind === "ok") {
                const cr = result.value;
                outputChannel.show(true);
                outputChannel.appendLine(`\n${"─".repeat(60)}`);
                outputChannel.appendLine(`[${new Date().toISOString()}] Conflict Resolution — ${cr.perFile?.length ?? 0} file(s)`);
                outputChannel.appendLine("─".repeat(60));
                outputChannel.appendLine(`\n${cr.overview}\n`);
                for (const f of cr.perFile ?? []) {
                    outputChannel.appendLine(`${f.path} → ${f.strategy}`);
                    outputChannel.appendLine(`  ${f.rationale}`);
                    for (const step of f.suggestedSteps ?? []) {
                        outputChannel.appendLine(`  • ${step}`);
                    }
                }
                outputChannel.appendLine("");
                vscode.window.showInformationMessage(`Conflict resolution for ${cr.perFile?.length ?? 0} file(s) — see Output`);
                return;
            }
            // chat.delegate — log delegated command result
            if (commandName === "chat.delegate" && result.kind === "ok") {
                const dr = result.value;
                const { message } = (0, result_handler_1.formatResultMessage)(dr.commandName, { kind: "ok", value: dr.result });
                outputChannel.appendLine(`[${new Date().toISOString()}] Delegated → ${dr.commandName}: ${message}`);
                vscode.window.showInformationMessage(`Delegated → ${dr.commandName}`);
                return;
            }
            const { level, message } = (0, result_handler_1.formatResultMessage)(commandName, result);
            outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
            if (level === "info") {
                vscode.window.showInformationMessage(message);
            }
            else {
                vscode.window.showErrorMessage(message);
            }
        });
        context.subscriptions.push(disposable);
    }
    const dispatch = (cmd, ctx) => router.dispatch(cmd, ctx);
    const gitTree = new git_tree_provider_1.GitTreeProvider(gitProvider, logger, workspaceRoot);
    const hygieneTree = new hygiene_tree_provider_1.HygieneTreeProvider(dispatch, cmdCtx, logger);
    const workflowTree = new workflow_tree_provider_1.WorkflowTreeProvider(dispatch, cmdCtx, logger);
    const agentTree = new agent_tree_provider_1.AgentTreeProvider(dispatch, cmdCtx, logger);
    context.subscriptions.push(vscode.window.registerTreeDataProvider("meridian.git.view", gitTree), vscode.window.registerTreeDataProvider("meridian.hygiene.view", hygieneTree), vscode.window.registerTreeDataProvider("meridian.workflow.view", workflowTree), vscode.window.registerTreeDataProvider("meridian.agent.view", agentTree));
    // Refresh commands — wire to each tree provider's refresh() method
    context.subscriptions.push(vscode.commands.registerCommand("meridian.git.refresh", () => gitTree.refresh()), vscode.commands.registerCommand("meridian.hygiene.refresh", () => hygieneTree.refresh()), vscode.commands.registerCommand("meridian.workflow.refresh", () => workflowTree.refresh()), vscode.commands.registerCommand("meridian.agent.refresh", () => agentTree.refresh()));
    // ── Status bar item ────────────────────────────────────────────────────
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    statusBar.name = "Meridian";
    statusBar.command = "meridian.statusBar.clicked";
    context.subscriptions.push(statusBar);
    async function updateStatusBar() {
        const status = await gitProvider.status();
        if (status.kind === "ok") {
            const s = status.value;
            const dirty = s.isDirty ? "$(circle-filled)" : "$(check)";
            const changes = s.staged + s.unstaged + s.untracked;
            statusBar.text = changes > 0
                ? `$(source-control) ${s.branch} ${dirty} ${changes}`
                : `$(source-control) ${s.branch} ${dirty}`;
            statusBar.tooltip = [
                `Branch: ${s.branch}`,
                `Staged: ${s.staged}`,
                `Unstaged: ${s.unstaged}`,
                `Untracked: ${s.untracked}`,
                ``,
                `Click for Meridian actions`,
            ].join("\n");
        }
        else {
            statusBar.text = "$(source-control) Meridian";
            statusBar.tooltip = "Git unavailable — click for Meridian actions";
        }
        statusBar.show();
    }
    // ── File watchers: auto-refresh tree views ────────────────────────────
    const debouncedGitRefresh = debounce(() => {
        gitTree.refresh();
        updateStatusBar();
    }, constants_1.UI_SETTINGS.WATCHER_DEBOUNCE_MS);
    const debouncedHygieneRefresh = debounce(() => {
        hygieneTree.refresh();
    }, constants_1.UI_SETTINGS.WATCHER_DEBOUNCE_MS);
    const debouncedDefinitionsRefresh = debounce(() => {
        workflowTree.refresh();
        agentTree.refresh();
    }, constants_1.UI_SETTINGS.WATCHER_DEBOUNCE_MS);
    // Git state: branch switches, staging, commits
    const gitWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspaceRoot, ".git/{HEAD,index,refs/**}"));
    gitWatcher.onDidChange(debouncedGitRefresh);
    gitWatcher.onDidCreate(debouncedGitRefresh);
    // Workspace files: create/delete affects hygiene scan
    const fileWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspaceRoot, "**/*"));
    fileWatcher.onDidCreate(debouncedHygieneRefresh);
    fileWatcher.onDidDelete(debouncedHygieneRefresh);
    // Agent/workflow definitions
    const defWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(workspaceRoot, ".vscode/{agents,workflows}/*.json"));
    defWatcher.onDidChange(debouncedDefinitionsRefresh);
    defWatcher.onDidCreate(debouncedDefinitionsRefresh);
    defWatcher.onDidDelete(debouncedDefinitionsRefresh);
    context.subscriptions.push(gitWatcher, fileWatcher, defWatcher);
    // ── Status bar click → QuickPick with top actions ─────────────────────
    context.subscriptions.push(vscode.commands.registerCommand("meridian.statusBar.clicked", async () => {
        const pick = await vscode.window.showQuickPick([
            { label: "$(git-commit) Smart Commit", command: "meridian.git.smartCommit" },
            { label: "$(search) Hygiene Scan", command: "meridian.hygiene.scan" },
            { label: "$(graph) Git Analytics", command: "meridian.git.showAnalytics" },
            { label: "$(graph) Hygiene Analytics", command: "meridian.hygiene.showAnalytics" },
            { label: "$(refresh) Refresh All Views", command: "meridian.refreshAll" },
        ], { placeHolder: "Meridian — choose an action" });
        if (pick) {
            vscode.commands.executeCommand(pick.command);
        }
    }));
    // ── Refresh All command ───────────────────────────────────────────────
    context.subscriptions.push(vscode.commands.registerCommand("meridian.refreshAll", () => {
        gitTree.refresh();
        hygieneTree.refresh();
        workflowTree.refresh();
        agentTree.refresh();
        updateStatusBar();
    }));
    // workflow.run — registered after tree providers so workflowTree is in scope.
    // VS Code passes the TreeItem as the first arg when invoked from context/inline menus
    // but passes { name: "..." } when invoked from it.command.arguments (click).
    context.subscriptions.push(vscode.commands.registerCommand("meridian.workflow.run", async (arg = {}) => {
        const freshCtx = getCommandContext(context);
        let name;
        if (arg && typeof arg === "object") {
            const obj = arg;
            if (typeof obj.name === "string" && obj.name) {
                name = obj.name;
            }
            else if (typeof obj.label === "string" && obj.label) {
                name = obj.label;
            }
        }
        if (!name) {
            vscode.window.showErrorMessage("No workflow selected.");
            return;
        }
        workflowTree.setRunning(name);
        const result = await router.dispatch({ name: "workflow.run", params: { name } }, freshCtx);
        const r = result.kind === "ok" ? result.value : null;
        workflowTree.setLastRun(name, r?.success ?? result.kind === "ok", r?.duration ?? 0);
        // Log to output channel only — tree item description shows the result
        const { message } = (0, result_handler_1.formatResultMessage)("workflow.run", result);
        outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
    }));
    // Hygiene file actions — registered after tree providers so hygieneTree is in scope.
    context.subscriptions.push(vscode.commands.registerCommand("meridian.hygiene.deleteFile", async (item) => {
        const filePath = item instanceof vscode.Uri ? item.fsPath : item?.filePath;
        if (!filePath)
            return;
        const filename = nodePath.basename(filePath);
        const confirm = await vscode.window.showWarningMessage(`Delete "${filename}"? This cannot be undone.`, { modal: true }, "Delete");
        if (confirm !== "Delete")
            return;
        const freshCtx = getCommandContext(context);
        const result = await router.dispatch({ name: "hygiene.cleanup", params: { files: [filePath] } }, freshCtx);
        if (result.kind === "ok") {
            vscode.window.showInformationMessage(`Deleted: ${filename}`);
            hygieneTree.refresh();
        }
        else {
            vscode.window.showErrorMessage(`Delete failed: ${result.error.message}`);
        }
    }), vscode.commands.registerCommand("meridian.hygiene.ignoreFile", async (item) => {
        const filePath = item instanceof vscode.Uri ? item.fsPath : item?.filePath;
        if (!filePath)
            return;
        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
        const ignorePath = nodePath.join(wsRoot, ".meridianignore");
        const pattern = nodePath.relative(wsRoot, filePath);
        fs.appendFileSync(ignorePath, `\n${pattern}\n`);
        vscode.window.showInformationMessage(`Added to .meridianignore: ${pattern}`);
        hygieneTree.refresh();
    }), vscode.commands.registerCommand("meridian.hygiene.reviewFile", async (item) => {
        const filePath = item instanceof vscode.Uri ? item.fsPath : item?.filePath;
        if (!filePath)
            return;
        let content;
        try {
            content = fs.readFileSync(filePath, "utf-8");
        }
        catch {
            vscode.window.showErrorMessage(`Could not read: ${nodePath.basename(filePath)}`);
            return;
        }
        const model = await (0, model_selector_1.selectModel)("hygiene");
        if (!model) {
            vscode.window.showErrorMessage("No language model available. Ensure GitHub Copilot is enabled.");
            return;
        }
        const filename = nodePath.basename(filePath);
        outputChannel.show(true);
        outputChannel.appendLine(`\n${"─".repeat(60)}`);
        outputChannel.appendLine(`[${new Date().toISOString()}] AI Review: ${filename}`);
        outputChannel.appendLine("─".repeat(60));
        const messages = [
            vscode.LanguageModelChatMessage.User(`You are a critical technical reviewer. Analyze this Markdown document and provide concise, actionable feedback on:\n1. Content accuracy and factual correctness\n2. Clarity and readability\n3. Completeness (gaps or missing context)\n4. Effectiveness (does it achieve its purpose?)\n5. Top 3 specific improvements\n\nDocument: ${filename}\n\`\`\`markdown\n${content}\n\`\`\``),
        ];
        try {
            const cts = new vscode.CancellationTokenSource();
            context.subscriptions.push(cts);
            const response = await model.sendRequest(messages, {}, cts.token);
            for await (const fragment of response.text) {
                outputChannel.append(fragment);
            }
            outputChannel.appendLine("\n");
        }
        catch (err) {
            outputChannel.appendLine(`[Error] Review failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }));
    // Register chat participant (@meridian in Copilot Chat)
    const chatParticipant = (0, chat_participant_1.createChatParticipant)(router, cmdCtx, logger);
    context.subscriptions.push(chatParticipant);
    // Register LM tools so Copilot and @meridian can invoke Meridian commands autonomously
    const toolDisposables = (0, lm_tools_1.registerMeridianTools)(router, cmdCtx, logger);
    context.subscriptions.push(...toolDisposables);
    // Initial status bar update
    updateStatusBar();
    logger.info(`Extension activated with ${router.listDomains().length} domains`, "activate");
    logger.info(`Registered ${COMMAND_MAP.length} commands`, "activate");
}
/**
 * Deactivate the extension.
 * Called when extension is unloaded. VS Code disposes subscriptions automatically;
 * router teardown cleans up domain services.
 */
async function deactivate() {
    // router is local to activate(); VS Code calls deactivate separately.
    // Domain teardown happens via context.subscriptions disposal.
    // No action needed here beyond the subscription cleanup VS Code performs.
}
var logger_2 = require("./infrastructure/logger");
Object.defineProperty(exports, "Logger", { enumerable: true, get: function () { return logger_2.Logger; } });
//# sourceMappingURL=main.js.map