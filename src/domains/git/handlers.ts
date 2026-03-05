/**
 * Git Domain Handlers — Core commit and pull operations.
 */

import {
  Handler,
  CommandContext,
  success,
  failure,
  GitStatus,
  Logger,
  GitProvider,
} from "../../types";
import { GIT_ERROR_CODES, GENERIC_ERROR_CODES } from "../../infrastructure/error-codes";

/**
 * Example: git.status — Read-only operation.
 * Returns current branch and dirty state.
 */
export function createStatusHandler(
  gitProvider: GitProvider,
  logger: Logger
): Handler<any, GitStatus> {
  return async (_ctx: CommandContext, params: any = {}) => {
    // Validate branch parameter shape when provided
    if (params.branch !== undefined && typeof params.branch !== "string") {
      return failure({
        code: GENERIC_ERROR_CODES.INVALID_PARAMS,
        message: "Branch must be a string when provided",
        context: "git.status",
      });
    }

    try {
      logger.debug(
        `Getting git status for branch: ${params.branch || "current"}`,
        "GitStatusHandler"
      );

      const result = await gitProvider.status(params.branch);
      if (result.kind === "ok") {
        return success(result.value);
      }
      return result;
    } catch (err) {
      return failure({
        code: GIT_ERROR_CODES.GIT_STATUS_ERROR,
        message: "Failed to fetch git status",
        details: err,
        context: "git.status",
      });
    }
  };
}

/**
 * Example: git.pull — Mutation operation.
 * Demonstrates error handling for conflicts, network issues.
 */
export function createPullHandler(
  gitProvider: GitProvider,
  logger: Logger
): Handler<any, void> {
  return async (_ctx: CommandContext, params: any = {}) => {
    // Validate branch parameter shape when provided
    if (params.branch !== undefined && typeof params.branch !== "string") {
      return failure({
        code: GENERIC_ERROR_CODES.INVALID_PARAMS,
        message: "Branch must be a string when provided",
        context: "git.pull",
      });
    }

    try {
      logger.info(
        `Pulling from git branch: ${params.branch || "current"}`,
        "GitPullHandler"
      );

      const result = await gitProvider.pull(params.branch);
      if (result.kind === "ok") {
        logger.info(
          `Pull successful: ${result.value.message}`,
          "GitPullHandler"
        );
        return success(void 0);
      }
      return result;
    } catch (err) {
      return failure({
        code: GIT_ERROR_CODES.GIT_PULL_ERROR,
        message: "Failed to pull from git",
        details: err,
        context: "git.pull",
      });
    }
  };
}

/**
 * Example: git.commit — Mutation with message parameter.
 * Demonstrates parameter validation.
 */
export function createCommitHandler(
  gitProvider: GitProvider,
  logger: Logger
): Handler<any, void> {
  return async (_ctx: CommandContext, params: any = { message: "" }) => {
    // Validate branch parameter shape when provided
    if (params.branch !== undefined && typeof params.branch !== "string") {
      return failure({
        code: GENERIC_ERROR_CODES.INVALID_PARAMS,
        message: "Branch must be a string when provided",
        context: "git.commit",
      });
    }

    // Validate required params
    if (!params.message || params.message.trim().length === 0) {
      return failure({
        code: GENERIC_ERROR_CODES.INVALID_PARAMS,
        message: "Commit message is required and cannot be empty",
        context: "git.commit",
      });
    }

    try {
      logger.info(
        `Committing with message: "${params.message}"`,
        "GitCommitHandler"
      );

      const result = await gitProvider.commit(params.message, params.branch);
      if (result.kind === "ok") {
        logger.info("Commit successful", "GitCommitHandler");
        return success(void 0);
      }
      return result;
    } catch (err) {
      return failure({
        code: GIT_ERROR_CODES.GIT_COMMIT_ERROR,
        message: "Failed to commit to git",
        details: err,
        context: "git.commit",
      });
    }
  };
}

