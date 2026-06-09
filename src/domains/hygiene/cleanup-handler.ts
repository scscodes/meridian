/**
 * Hygiene Domain Cleanup Handler — file removal from the workspace.
 */

import {
  Handler,
  CommandContext,
  success,
  failure,
  WorkspaceProvider,
  Logger,
} from "../../types";
import { HYGIENE_ERROR_CODES } from "../../infrastructure/error-codes";

export interface CleanupParams {
  dryRun?: boolean;
  files?: string[];
}

export interface CleanupResult {
  dryRun: boolean;
  files: string[];
  deleted: string[];
  failed: Array<{ path: string; reason: string }>;
}

/**
 * hygiene.cleanup — Remove specified files from the workspace.
 * Safety: requires an explicit file list; never deletes without one.
 * If dryRun=true, returns the list of files that WOULD be deleted without touching the FS.
 */
export function createCleanupHandler(
  workspaceProvider: WorkspaceProvider,
  logger: Logger
): Handler<CleanupParams, CleanupResult> {
  return async (_ctx: CommandContext, params: CleanupParams = {}) => {
    try {
      const { dryRun = false, files } = params;

      if (!files || files.length === 0) {
        return failure({
          code: HYGIENE_ERROR_CODES.HYGIENE_CLEANUP_NO_FILES,
          message: "Cleanup requires an explicit file list; none provided",
          context: "hygiene.cleanup",
        });
      }

      const mode = dryRun ? "DRY RUN" : "EXECUTE";
      logger.info(
        `Starting cleanup (${mode}) for ${files.length} file(s)`,
        "HygieneCleanupHandler"
      );

      if (dryRun) {
        logger.info(
          `Dry-run complete: ${files.length} file(s) would be deleted`,
          "HygieneCleanupHandler"
        );
        return success({
          dryRun: true,
          files,
          deleted: [],
          failed: [],
        });
      }

      const deleted: string[] = [];
      const failed: Array<{ path: string; reason: string }> = [];

      for (const filePath of files) {
        const result = await workspaceProvider.deleteFile(filePath);
        if (result.kind === "ok") {
          deleted.push(filePath);
          logger.debug(`Deleted: ${filePath}`, "HygieneCleanupHandler");
        } else {
          failed.push({ path: filePath, reason: result.error.message });
          logger.warn(
            `Failed to delete: ${filePath} — ${result.error.message}`,
            "HygieneCleanupHandler",
            result.error
          );
        }
      }

      logger.info(
        `Cleanup complete: ${deleted.length} deleted, ${failed.length} failed`,
        "HygieneCleanupHandler"
      );

      return success({ dryRun: false, files, deleted, failed });
    } catch (err) {
      return failure({
        code: HYGIENE_ERROR_CODES.HYGIENE_CLEANUP_ERROR,
        message: "Cleanup operation failed",
        details: err,
        context: "hygiene.cleanup",
      });
    }
  };
}
