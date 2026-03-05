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
  GenerateProseFn,
} from "../../types";
import { CHAT_ERROR_CODES } from "../../infrastructure/error-codes";
import { getPrompt } from "../../infrastructure/prompt-registry";
import { KNOWN_COMMAND_NAMES } from "../../infrastructure/command-catalog";

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
        code: CHAT_ERROR_CODES.CHAT_CONTEXT_ERROR,
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

/** Re-exported for backward compatibility — canonical definition in src/types.ts */
export type { GenerateProseFn } from "../../types";

// Derived from COMMAND_CATALOG — do not edit here directly.
const KNOWN_COMMANDS = KNOWN_COMMAND_NAMES;

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
          code: CHAT_ERROR_CODES.CHAT_DELEGATE_NO_GENERATE_FN,
          message: "chat.delegate requires a prose generation function (is Copilot enabled?)",
          context: "chat.delegate",
        });
      }

      logger.info(`Classifying task: "${task}"`, "ChatDelegateHandler");

      const classifyResult = await generateProseFn({
        domain: "chat",
        systemPrompt: getPrompt("DELEGATE_CLASSIFIER"),
        data: { task },
      });

      if (classifyResult.kind === "err") {
        return failure(classifyResult.error);
      }

      const raw = classifyResult.value.trim().split("\n")[0].trim();

      // Handle parameterized command: workflow.run:<name>
      let commandName: string;
      let dispatchParams: Record<string, unknown> = {};
      if (raw.startsWith("workflow.run:")) {
        commandName = "workflow.run";
        dispatchParams = { name: raw.slice("workflow.run:".length).trim() };
      } else {
        commandName = KNOWN_COMMANDS.has(raw) ? raw : "chat.context";
      }

      logger.info(`Classified as: "${commandName}" (raw: "${raw}")`, "ChatDelegateHandler");

      const dispatchResult = await dispatcher({ name: commandName as any, params: dispatchParams }, ctx);

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
        code: CHAT_ERROR_CODES.CHAT_DELEGATE_ERROR,
        message: "Failed to delegate task",
        details: err,
        context: "chat.delegate",
      });
    }
  };
}
