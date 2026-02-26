/**
 * Hygiene Domain Handlers — workspace cleanup and analysis.
 */

import {
  Handler,
  CommandContext,
  success,
  failure,
  WorkspaceScan,
  WorkspaceProvider,
  Logger,
} from "../../types";
import { HYGIENE_SETTINGS } from "../../constants";

// ============================================================================
// Scan Handler
// ============================================================================

/**
 * hygiene.scan — Analyze workspace for dead files, large files, and stale logs.
 * Uses WorkspaceProvider.findFiles() with patterns from HYGIENE_SETTINGS.
 * Large-file detection reads file content to measure byte length (no stat API available).
 */
export function createScanHandler(
  workspaceProvider: WorkspaceProvider,
  logger: Logger
): Handler<Record<string, never>, WorkspaceScan> {
  return async (_ctx: CommandContext) => {
    try {
      logger.info("Scanning workspace for hygiene issues", "HygieneScanHandler");

      // --- Dead files: temp/backup patterns ---
      const deadFiles: string[] = [];
      const deadPatterns = [
        "**/*.bak",
        "**/*.tmp",
        "**/*.temp",
        "**/*.orig",
        "**/*.swp",
        "**/*~",
        ...HYGIENE_SETTINGS.TEMP_FILE_PATTERNS.map((p) => `**/${p}`),
      ];

      // Deduplicate patterns before scanning
      const uniqueDeadPatterns = [...new Set(deadPatterns)];

      for (const pattern of uniqueDeadPatterns) {
        const result = await workspaceProvider.findFiles(pattern);
        if (result.kind === "ok") {
          for (const f of result.value) {
            if (!deadFiles.includes(f)) {
              deadFiles.push(f);
            }
          }
        }
      }

      // --- Log files ---
      const logFiles: string[] = [];
      const logPatterns = HYGIENE_SETTINGS.LOG_FILE_PATTERNS.map((p) => `**/${p}`);

      for (const pattern of logPatterns) {
        const result = await workspaceProvider.findFiles(pattern);
        if (result.kind === "ok") {
          for (const f of result.value) {
            if (!logFiles.includes(f)) {
              logFiles.push(f);
            }
          }
        }
      }

      // --- Large files: read content to measure size ---
      const largeFiles: Array<{ path: string; sizeBytes: number }> = [];
      const allFilesResult = await workspaceProvider.findFiles("**/*");

      if (allFilesResult.kind === "ok") {
        for (const filePath of allFilesResult.value) {
          const readResult = await workspaceProvider.readFile(filePath);
          if (readResult.kind === "ok") {
            const sizeBytes = Buffer.byteLength(readResult.value, "utf8");
            if (sizeBytes > HYGIENE_SETTINGS.MAX_FILE_SIZE_BYTES) {
              largeFiles.push({ path: filePath, sizeBytes });
            }
          }
        }
      }

      const scan: WorkspaceScan = {
        deadFiles,
        largeFiles,
        logFiles,
      };

      logger.info(
        `Found ${scan.deadFiles.length} dead files, ${scan.largeFiles.length} large files, ${scan.logFiles.length} log files`,
        "HygieneScanHandler"
      );

      return success(scan);
    } catch (err) {
      return failure({
        code: "HYGIENE_SCAN_ERROR",
        message: "Workspace scan failed",
        details: err,
        context: "hygiene.scan",
      });
    }
  };
}

// ============================================================================
// Cleanup Handler
// ============================================================================

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
          code: "HYGIENE_CLEANUP_NO_FILES",
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
        code: "HYGIENE_CLEANUP_ERROR",
        message: "Cleanup operation failed",
        details: err,
        context: "hygiene.cleanup",
      });
    }
  };
}
