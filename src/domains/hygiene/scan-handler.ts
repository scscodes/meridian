/**
 * Hygiene Domain Scan Handler — workspace analysis for dead files, large files, and stale logs.
 */

import * as path from "path";
import {
  Handler,
  CommandContext,
  success,
  failure,
  WorkspaceScan,
  DeadCodeScan,
  MarkdownFile,
  WorkspaceProvider,
  Logger,
} from "../../types";
import { HYGIENE_SETTINGS } from "../../constants";
import { HYGIENE_ERROR_CODES, INFRASTRUCTURE_ERROR_CODES } from "../../infrastructure/error-codes";
import { pathMatchesAny } from "../../infrastructure/glob-match";
import { readGitignorePatterns, readMeridianIgnorePatterns } from "../../security/ignore-store";
import { DeadCodeAnalyzer } from "./dead-code-analyzer";
import { detectCollections } from "./collection-detector";

/**
 * hygiene.scan — Analyze workspace for dead files, large files, and stale logs.
 * Uses WorkspaceProvider.findFiles() with patterns from HYGIENE_SETTINGS.
 * Large-file detection uses file metadata (statFile) — content is never read.
 */
export function createScanHandler(
  workspaceProvider: WorkspaceProvider,
  logger: Logger,
  deadCodeAnalyzer: DeadCodeAnalyzer,
  onScanSuccess?: (scan: WorkspaceScan, scannedAt: string) => void
): Handler<Record<string, never>, WorkspaceScan> {
  return async (ctx: CommandContext) => {
    try {
      logger.info("Scanning workspace for hygiene issues", "HygieneScanHandler");

      const workspaceRoot = ctx.workspaceFolders?.[0];
      if (!workspaceRoot) {
        return failure({
          code: INFRASTRUCTURE_ERROR_CODES.WORKSPACE_NOT_FOUND,
          message: "No workspace folder found",
          context: "hygiene.scan",
        });
      }
      const gitignorePatterns = readGitignorePatterns(workspaceRoot);
      const meridianIgnorePatterns = readMeridianIgnorePatterns(workspaceRoot);
      const excludePatterns = [
        ...HYGIENE_SETTINGS.EXCLUDE_PATTERNS,
        ...gitignorePatterns,
        ...meridianIgnorePatterns,
      ];

      // findFiles may return absolute paths; ignore patterns (including
      // root-anchored .gitignore entries) match workspace-relative paths.
      const isExcluded = (filePath: string): boolean =>
        pathMatchesAny(path.isAbsolute(filePath) ? path.relative(workspaceRoot, filePath) : filePath, excludePatterns);

      // --- Dead files: temp/backup patterns (sourced from HYGIENE_SETTINGS.TEMP_FILE_PATTERNS) ---
      const deadFileSet = new Set<string>();
      const deadPatterns = HYGIENE_SETTINGS.TEMP_FILE_PATTERNS.map((p) => `**/${p}`);

      for (const pattern of deadPatterns) {
        const result = await workspaceProvider.findFiles(pattern);
        if (result.kind === "ok") {
          for (const f of result.value) {
            if (!isExcluded(f)) deadFileSet.add(f);
          }
        }
      }
      const deadFiles = Array.from(deadFileSet);

      // --- Log files ---
      const logFileSet = new Set<string>();
      const logPatterns = HYGIENE_SETTINGS.LOG_FILE_PATTERNS.map((p) => `**/${p}`);

      for (const pattern of logPatterns) {
        const result = await workspaceProvider.findFiles(pattern);
        if (result.kind === "ok") {
          for (const f of result.value) {
            if (!isExcluded(f)) logFileSet.add(f);
          }
        }
      }
      const logFiles = Array.from(logFileSet);

      // --- Large files: metadata size only, skip excluded paths ---
      const largeFiles: Array<{ path: string; sizeBytes: number }> = [];
      const allFilesResult = await workspaceProvider.findFiles("**/*");

      if (allFilesResult.kind === "ok") {
        for (const filePath of allFilesResult.value) {
          if (isExcluded(filePath)) {
            continue;
          }
          const statResult = await workspaceProvider.statFile(filePath);
          if (statResult.kind === "ok" && statResult.value.sizeBytes > HYGIENE_SETTINGS.MAX_FILE_SIZE_BYTES) {
            largeFiles.push({ path: filePath, sizeBytes: statResult.value.sizeBytes });
          }
        }
      }

      // --- Markdown files: collect all .md files with size + line count ---
      const markdownFiles: MarkdownFile[] = [];
      const mdResult = await workspaceProvider.findFiles("**/*.md");
      if (mdResult.kind === "ok") {
        for (const filePath of mdResult.value) {
          if (isExcluded(filePath)) continue;
          const readResult = await workspaceProvider.readFile(filePath);
          if (readResult.kind === "ok") {
            const sizeBytes = Buffer.byteLength(readResult.value, "utf8");
            const lineCount = readResult.value.split("\n").length;
            markdownFiles.push({ path: filePath, sizeBytes, lineCount });
          }
        }
      }

      // --- Dead code: unused imports, locals, params (TS compiler diagnostics) ---
      let deadCode: DeadCodeScan = { items: [], tsconfigPath: null, durationMs: 0, fileCount: 0 };
      try {
        deadCode = deadCodeAnalyzer.analyze(workspaceRoot);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.warn(`Dead code scan failed: ${errMsg}`, "HygieneScanHandler");
        deadCode = { items: [], tsconfigPath: null, durationMs: 0, fileCount: 0, error: errMsg };
      }

      // Shallow heavy-artifact dir scan for sidebar Collections entries.
      // Bounded depth (≤3) and short-circuits at the first matched bucket,
      // so this stays cheap even on big monorepos.
      const collections = detectCollections(workspaceRoot);

      const scan: WorkspaceScan = {
        deadFiles,
        largeFiles,
        logFiles,
        markdownFiles,
        deadCode,
        collections,
      };

      logger.info(
        `Found ${scan.deadFiles.length} dead, ${scan.largeFiles.length} large, ${scan.logFiles.length} log, ${scan.markdownFiles.length} markdown, ${scan.deadCode.items.length} dead-code items, ${collections.envs.length + collections.caches.length + collections.buildOutputs.length + collections.vendoredDeps.length} collection dirs`,
        "HygieneScanHandler"
      );

      onScanSuccess?.(scan, new Date().toISOString());
      return success(scan);
    } catch (err) {
      return failure({
        code: HYGIENE_ERROR_CODES.HYGIENE_SCAN_ERROR,
        message: "Workspace scan failed",
        details: err,
        context: "hygiene.scan",
      });
    }
  };
}
