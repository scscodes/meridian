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
  workflow?: string;
}

export interface DelegateResult {
  dispatched: boolean;
  workflow?: string;
  message: string;
}

/** Minimal dispatcher interface; satisfied by CommandRouter.dispatch */
export type CommandDispatcher = (
  command: Command,
  ctx: CommandContext
) => Promise<Result<unknown>>;

/**
 * chat.delegate — Backend command dispatcher.
 * If params.workflow is provided, dispatches "workflow.run" via the injected dispatcher.
 * No LLM calls, no chat UI — pure backend routing.
 */
export function createDelegateHandler(
  dispatcher: CommandDispatcher,
  logger: Logger
): Handler<DelegateParams, DelegateResult> {
  return async (ctx: CommandContext, params: DelegateParams) => {
    try {
      const { task, workflow } = params;

      if (!workflow) {
        logger.warn(
          `Delegate called for task "${task}" with no workflow target`,
          "ChatDelegateHandler"
        );
        return failure({
          code: "CHAT_DELEGATE_NO_TARGET",
          message: "No delegation target: provide a workflow name",
          context: "chat.delegate",
        });
      }

      logger.info(
        `Delegating task "${task}" to workflow "${workflow}"`,
        "ChatDelegateHandler"
      );

      const command: Command<{ name: string; task: string }> = {
        name: "workflow.run",
        params: { name: workflow, task },
      };

      const result = await dispatcher(command, ctx);

      if (result.kind === "err") {
        logger.warn(
          `Workflow dispatch failed for "${workflow}": ${result.error.message}`,
          "ChatDelegateHandler",
          result.error
        );
        return failure(result.error);
      }

      logger.info(
        `Workflow "${workflow}" dispatched successfully`,
        "ChatDelegateHandler"
      );

      return success({
        dispatched: true,
        workflow,
        message: `Workflow "${workflow}" dispatched for task "${task}"`,
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
