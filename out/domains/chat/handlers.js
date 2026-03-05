"use strict";
/**
 * Chat/Copilot Domain Handlers — local context gathering and task delegation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContextHandler = createContextHandler;
exports.createDelegateHandler = createDelegateHandler;
const types_1 = require("../../types");
const error_codes_1 = require("../../infrastructure/error-codes");
const prompt_registry_1 = require("../../infrastructure/prompt-registry");
// ============================================================================
// Context Handler
// ============================================================================
/**
 * chat.context — Gather chat context from workspace + git.
 * Returns active file path, current git branch, and git status.
 */
function createContextHandler(gitProvider, logger) {
    return async (ctx) => {
        try {
            logger.info("Gathering chat context", "ChatContextHandler");
            const statusResult = await gitProvider.status();
            const gitStatus = statusResult.kind === "ok" ? statusResult.value : undefined;
            const chatCtx = {
                activeFile: ctx.activeFilePath,
                gitBranch: gitStatus?.branch,
                gitStatus,
            };
            logger.debug(`Context gathered: file=${chatCtx.activeFile ?? "none"}, branch=${chatCtx.gitBranch ?? "none"}`, "ChatContextHandler");
            return (0, types_1.success)(chatCtx);
        }
        catch (err) {
            return (0, types_1.failure)({
                code: error_codes_1.CHAT_ERROR_CODES.CHAT_CONTEXT_ERROR,
                message: "Failed to gather chat context",
                details: err,
                context: "chat.context",
            });
        }
    };
}
const KNOWN_COMMANDS = new Set([
    "git.status", "git.smartCommit", "git.pull", "git.analyzeInbound",
    "git.showAnalytics", "git.exportJson", "git.exportCsv",
    "git.generatePR", "git.reviewPR", "git.commentPR",
    "git.resolveConflicts", "git.sessionBriefing",
    "hygiene.scan", "hygiene.showAnalytics", "hygiene.cleanup", "hygiene.impactAnalysis",
    "workflow.list", "workflow.run", "agent.list", "agent.execute",
]);
/**
 * chat.delegate — Programmatic task router.
 * Uses the LLM to classify a free-form task description into a command, then
 * dispatches it. Intended for workflows, LM tools, and future agents — not the
 * chat UX (which routes directly via SLASH_MAP/KEYWORD_MAP/classifier).
 */
function createDelegateHandler(dispatcher, logger, generateProseFn) {
    return async (ctx, params) => {
        try {
            const { task } = params;
            if (!generateProseFn) {
                return (0, types_1.failure)({
                    code: error_codes_1.CHAT_ERROR_CODES.CHAT_DELEGATE_NO_GENERATE_FN,
                    message: "chat.delegate requires a prose generation function (is Copilot enabled?)",
                    context: "chat.delegate",
                });
            }
            logger.info(`Classifying task: "${task}"`, "ChatDelegateHandler");
            const classifyResult = await generateProseFn({
                domain: "chat",
                systemPrompt: (0, prompt_registry_1.getPrompt)("DELEGATE_CLASSIFIER"),
                data: { task },
            });
            if (classifyResult.kind === "err") {
                return (0, types_1.failure)(classifyResult.error);
            }
            const raw = classifyResult.value.trim().split("\n")[0].trim();
            // Handle parameterized command: workflow.run:<name>
            let commandName;
            let dispatchParams = {};
            if (raw.startsWith("workflow.run:")) {
                commandName = "workflow.run";
                dispatchParams = { name: raw.slice("workflow.run:".length).trim() };
            }
            else {
                commandName = KNOWN_COMMANDS.has(raw) ? raw : "chat.context";
            }
            logger.info(`Classified as: "${commandName}" (raw: "${raw}")`, "ChatDelegateHandler");
            const dispatchResult = await dispatcher({ name: commandName, params: dispatchParams }, ctx);
            if (dispatchResult.kind === "err") {
                logger.warn(`Dispatch failed for "${commandName}": ${dispatchResult.error.message}`, "ChatDelegateHandler", dispatchResult.error);
                return (0, types_1.failure)(dispatchResult.error);
            }
            logger.info(`Delegated "${task}" → "${commandName}" successfully`, "ChatDelegateHandler");
            return (0, types_1.success)({
                dispatched: true,
                commandName,
                result: dispatchResult.value,
            });
        }
        catch (err) {
            return (0, types_1.failure)({
                code: error_codes_1.CHAT_ERROR_CODES.CHAT_DELEGATE_ERROR,
                message: "Failed to delegate task",
                details: err,
                context: "chat.delegate",
            });
        }
    };
}
//# sourceMappingURL=handlers.js.map