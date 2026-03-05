/**
 * Smart Commit Handler — Change grouping and batch commit orchestration.
 */

import {
  Handler,
  CommandContext,
  success,
  failure,
  Logger,
  GitProvider,
  GitFileChange,
} from "../../types";
import { GIT_ERROR_CODES, GENERIC_ERROR_CODES } from "../../infrastructure/error-codes";
import {
  FileChange,
  ChangeGroup,
  SmartCommitParams,
  SmartCommitBatchResult,
  ApprovalUI,
} from "./types";
import {
  ChangeGrouper,
  CommitMessageSuggester,
  BatchCommitter,
} from "./smart-commit-service";

/**
 * Example: git.smartCommit — Interactive staged commit with validation.
 * Demonstrates complex workflow: stage → diff → validate message → commit.
 */
export function createSmartCommitHandler(
  gitProvider: GitProvider,
  logger: Logger,
  changeGrouper: ChangeGrouper,
  messageSuggester: CommitMessageSuggester,
  batchCommitter: BatchCommitter,
  approvalUI?: ApprovalUI
): Handler<SmartCommitParams, SmartCommitBatchResult> {
  return async (
    _ctx: CommandContext,
    params: SmartCommitParams = {}
  ) => {
    const startTime = Date.now();

    try {
      // Validate parameters
      if (
        params.autoApprove !== undefined &&
        typeof params.autoApprove !== "boolean"
      ) {
        return failure({
          code: GENERIC_ERROR_CODES.INVALID_PARAMS,
          message: "autoApprove must be a boolean when provided",
          context: "git.smartCommit",
        });
      }

      if (params.branch !== undefined && typeof params.branch !== "string") {
        return failure({
          code: GENERIC_ERROR_CODES.INVALID_PARAMS,
          message: "Branch must be a string when provided",
          context: "git.smartCommit",
        });
      }

      logger.info(
        `Smart commit: analyzing changes for branch ${params.branch || "current"}`,
        "GitSmartCommitHandler"
      );

      // Step 1: Get all changes (staged + unstaged)
      const changesResult = await gitProvider.getAllChanges();
      if (changesResult.kind === "err") {
        return failure({
          code: GIT_ERROR_CODES.GET_CHANGES_FAILED,
          message: "Failed to get git changes",
          details: changesResult.error,
          context: "git.smartCommit",
        });
      }

      if (changesResult.value.length === 0) {
        return failure({
          code: GIT_ERROR_CODES.NO_CHANGES,
          message: "No changes to commit",
          context: "git.smartCommit",
        });
      }

      logger.info(
        `Found ${changesResult.value.length} changed files`,
        "GitSmartCommitHandler"
      );

      // Step 2: Parse changes into FileChange[]
      const fileChanges = parseFileChanges(changesResult.value);
      logger.debug(
        `Parsed ${fileChanges.length} file changes with metadata`,
        "GitSmartCommitHandler"
      );

      // Step 3: Group similar changes
      const groups = changeGrouper.group(fileChanges);
      logger.info(
        `Grouped ${fileChanges.length} files into ${groups.length} groups`,
        "GitSmartCommitHandler"
      );

      // Step 4: Suggest commit messages for each group
      const groupsWithMessages = groups.map((g: ChangeGroup) => ({
        ...g,
        suggestedMessage: messageSuggester.suggest(g),
      }));

      // Step 5: Present to user for approval (or auto-approve)
      let approvedGroups: ChangeGroup[];

      if (params.autoApprove || !approvalUI) {
        // Programmatic path: skip UI entirely
        approvedGroups = groupsWithMessages;
        logger.info(
          `Auto-approving all ${groupsWithMessages.length} group(s)`,
          "GitSmartCommitHandler"
        );
      } else {
        // Interactive path: show approval UI
        logger.info(
          `Presenting ${groupsWithMessages.length} group(s) for user approval`,
          "GitSmartCommitHandler"
        );

        const approvalResult = await approvalUI(groupsWithMessages);

        // null = user cancelled (Escape)
        if (approvalResult === null) {
          return failure({
            code: GIT_ERROR_CODES.COMMIT_CANCELLED,
            message: "Smart commit cancelled by user",
            context: "git.smartCommit",
          });
        }

        // Patch approved messages back onto groups for BatchCommitter
        approvedGroups = approvalResult.map((item) => ({
          ...item.group,
          suggestedMessage: {
            ...item.group.suggestedMessage,
            full: item.approvedMessage,
          },
        }));
      }

      if (approvedGroups.length === 0) {
        return failure({
          code: GIT_ERROR_CODES.NO_GROUPS_APPROVED,
          message: "No groups approved for commit",
          context: "git.smartCommit",
        });
      }

      // Step 6: Execute batch commits
      const commitResult = await batchCommitter.executeBatch(approvedGroups);
      if (commitResult.kind === "err") {
        return commitResult;
      }

      const duration = Date.now() - startTime;
      const result: SmartCommitBatchResult = {
        commits: commitResult.value,
        totalFiles: fileChanges.length,
        totalGroups: groups.length,
        duration,
      };

      logger.info(
        `Smart commit completed: ${result.commits.length} commits, ${result.totalFiles} files in ${duration}ms`,
        "GitSmartCommitHandler"
      );

      return success(result);
    } catch (err) {
      logger.error(
        "Smart commit error",
        "GitSmartCommitHandler",
        {
          code: GIT_ERROR_CODES.SMART_COMMIT_ERROR,
          message: "Unexpected error during smart commit",
          details: err,
        }
      );

      return failure({
        code: GIT_ERROR_CODES.SMART_COMMIT_ERROR,
        message: "Failed to execute smart commit",
        details: err,
        context: "git.smartCommit",
      });
    }
  };
}

/**
 * Helper: Parse GitFileChange[] into FileChange[] with metadata.
 */
export function parseFileChanges(changes: GitFileChange[]): FileChange[] {
  const getFileType = (path: string): string => {
    const match = path.match(/\.([a-z]+)$/i);
    return match ? `.${match[1]}` : "";
  };

  const extractDomain = (path: string): string => {
    const parts = path.split("/");
    if (parts[0] === "src" && parts[1]) {
      if (parts[1] === "domains" && parts[2]) {
        return parts[2];
      }
      if (parts[1] === "infrastructure") {
        return "infrastructure";
      }
    }
    return parts[0] || "root";
  };

  return changes.map((change) => ({
    path: change.path,
    status: change.status,
    domain: extractDomain(change.path),
    fileType: getFileType(change.path),
    additions: change.additions,
    deletions: change.deletions,
  }));
}
