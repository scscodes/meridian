/**
 * Chat/Copilot Domain Handlers — local context gathering and task delegation.
 */

import {
  Handler,
  CommandContext,
  Command,
  Result,
  success,
  failure,
  ChatContext,
  Logger,
  GitProvider,
} from "../../types";

// ============================================================================
// Context Handler
// ============================================================================

/**
 * chat.context — Gather chat context from workspace + git.
 * Returns active file path, current git branch, and git status.
 */
export function createContextHandler(
  gitProvider: GitProvider,
  logger: Logger
): Handler<Record<string, never>, ChatContext> {
  return async (ctx: CommandContext) => {
    try {
      logger.info("Gathering chat context", "ChatContextHandler");

      const statusResult = await gitProvider.status();
      const gitStatus =
        statusResult.kind === "ok" ? statusResult.value : undefined;

      const chatCtx: ChatContext = {
        activeFile: ctx.activeFilePath,
        gitBranch: gitStatus?.branch,
        gitStatus,
      };

      logger.debug(
        `Context gathered: file=${chatCtx.activeFile ?? "none"}, branch=${chatCtx.gitBranch ?? "none"}`,
        "ChatContextHandler"
      );

      return success(chatCtx);
    } catch (err) {
      return failure({
        code: "CHAT_CONTEXT_ERROR",
        message: "Failed to gather chat context",
        details: err,
        context: "chat.context",
      });
    }
  };
}

// ============================================================================
// Delegate Handler
// ============================================================================

export interface DelegateParams {
  task: string;
}

export interface DelegateResult {
  dispatched: boolean;
  commandName: string;
  result: unknown;
}

/** Minimal dispatcher interface; satisfied by CommandRouter.dispatch */
export type CommandDispatcher = (
  command: Command,
  ctx: CommandContext
) => Promise<Result<unknown>>;

/**
 * Minimal prose generation interface — compatible with generateProse from infrastructure
 * without introducing a cross-domain import.
 */
export type GenerateProseFn = (req: {
  domain: "hygiene" | "git" | "chat";
  systemPrompt: string;
  data: Record<string, unknown>;
}) => Promise<Result<string>>;

const DELEGATE_CLASSIFIER_PROMPT = `You are a command router for the Meridian VS Code extension.
Given a task description, respond with EXACTLY ONE command ID that best handles it.

git.status            – check branch state
git.smartCommit       – group and commit staged changes
git.pull              – pull remote changes
git.analyzeInbound    – analyze incoming remote changes for conflicts
git.showAnalytics     – show git analytics report
git.generatePR        – generate a PR description
git.reviewPR          – review branch changes (verdict + comments)
git.commentPR         – generate inline review comments
git.resolveConflicts  – suggest conflict resolution strategies
git.sessionBriefing   – generate a morning session briefing
hygiene.scan          – scan workspace for dead files, large files, logs
hygiene.showAnalytics – show hygiene analytics
hygiene.cleanup       – delete flagged files from a hygiene scan (dry-run safe)
hygiene.impactAnalysis – trace blast radius of a file or function
workflow.list         – list available workflows
workflow.run          – execute a named workflow
agent.list            – list available agents
agent.execute         – run a named agent with a target command or workflow

Respond with ONLY the command ID. Nothing else.`;

const KNOWN_COMMANDS = new Set([
  "git.status", "git.smartCommit", "git.pull", "git.analyzeInbound",
  "git.showAnalytics", "git.generatePR", "git.reviewPR", "git.commentPR",
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
export function createDelegateHandler(
  dispatcher: CommandDispatcher,
  logger: Logger,
  generateProseFn?: GenerateProseFn
): Handler<DelegateParams, DelegateResult> {
  return async (ctx: CommandContext, params: DelegateParams) => {
    try {
      const { task } = params;

      if (!generateProseFn) {
        return failure({
          code: "CHAT_DELEGATE_NO_GENERATE_FN",
          message: "chat.delegate requires a prose generation function (is Copilot enabled?)",
          context: "chat.delegate",
        });
      }

      logger.info(`Classifying task: "${task}"`, "ChatDelegateHandler");

      const classifyResult = await generateProseFn({
        domain: "chat",
        systemPrompt: DELEGATE_CLASSIFIER_PROMPT,
        data: { task },
      });

      if (classifyResult.kind === "err") {
        return failure(classifyResult.error);
      }

      const raw = classifyResult.value.trim().split("\n")[0].trim();
      const commandName = KNOWN_COMMANDS.has(raw) ? raw : "chat.context";

      logger.info(`Classified as: "${commandName}" (raw: "${raw}")`, "ChatDelegateHandler");

      const dispatchResult = await dispatcher({ name: commandName as any, params: {} }, ctx);

      if (dispatchResult.kind === "err") {
        logger.warn(
          `Dispatch failed for "${commandName}": ${dispatchResult.error.message}`,
          "ChatDelegateHandler",
          dispatchResult.error
        );
        return failure(dispatchResult.error);
      }

      logger.info(`Delegated "${task}" → "${commandName}" successfully`, "ChatDelegateHandler");

      return success({
        dispatched: true,
        commandName,
        result: dispatchResult.value,
      });
    } catch (err) {
      return failure({
        code: "CHAT_DELEGATE_ERROR",
        message: "Failed to delegate task",
        details: err,
        context: "chat.delegate",
      });
    }
  };
}
