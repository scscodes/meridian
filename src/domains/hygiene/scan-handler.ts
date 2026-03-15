/**
 * Hygiene Domain Scan Handler — workspace analysis for dead files, large files, and stale logs.
 */

import * as fs from "fs";
import * as path from "path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const micromatch = require("micromatch");
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
import { HYGIENE_ERROR_CODES } from "../../infrastructure/error-codes";
import { DeadCodeAnalyzer } from "./dead-code-analyzer";

/**
 * Read and parse .gitignore patterns from the workspace root.
 * Returns an array of glob patterns safe to pass to micromatch.
 */
function readGitignorePatterns(workspaceRoot: string): string[] {
  try {
    const gitignorePath = path.join(workspaceRoot, ".gitignore");
    const content = fs.readFileSync(gitignorePath, "utf-8");
    return content
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith("#"))
      .map(line => {
        // Strip trailing slash (directory marker), then always anchor with **/
        // so patterns match against absolute paths from micromatch.isMatch()
        const stripped = line.endsWith("/") ? line.slice(0, -1) : line;
        return stripped.startsWith("**/") ? stripped : `**/${stripped}`;
      });
  } catch {
    return [];
  }
}

function readMeridianIgnorePatterns(workspaceRoot: string): string[] {
  try {
    const meridianIgnorePath = path.join(workspaceRoot, ".meridianignore");
    const content = fs.readFileSync(meridianIgnorePath, "utf-8");
    return content
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith("#"))
      .map(line => {
        const stripped = line.endsWith("/") ? line.slice(0, -1) : line;
        return stripped.startsWith("**/") ? stripped : `**/${stripped}`;
      });
  } catch {
    return [];
  }
}

function isExcluded(filePath: string, patterns: string[]): boolean {
  return patterns.length > 0 && micromatch.isMatch(filePath, patterns);
}

/**
 * hygiene.scan — Analyze workspace for dead files, large files, and stale logs.
 * Uses WorkspaceProvider.findFiles() with patterns from HYGIENE_SETTINGS.
 * Large-file detection reads file content to measure byte length (no stat API available).
 */
export function createScanHandler(
  workspaceProvider: WorkspaceProvider,
  logger: Logger,
  deadCodeAnalyzer: DeadCodeAnalyzer
): Handler<Record<string, never>, WorkspaceScan> {
  return async (ctx: CommandContext) => {
    try {
      logger.info("Scanning workspace for hygiene issues", "HygieneScanHandler");

      const workspaceRoot = ctx.workspaceFolders?.[0] ?? process.cwd();
      const gitignorePatterns = readGitignorePatterns(workspaceRoot);
      const meridianIgnorePatterns = readMeridianIgnorePatterns(workspaceRoot);
      const excludePatterns = [
        ...HYGIENE_SETTINGS.EXCLUDE_PATTERNS,
        ...gitignorePatterns,
        ...meridianIgnorePatterns,
      ];

      // --- Dead files: temp/backup patterns (sourced from HYGIENE_SETTINGS.TEMP_FILE_PATTERNS) ---
      const deadFiles: string[] = [];
      const deadPatterns = HYGIENE_SETTINGS.TEMP_FILE_PATTERNS.map((p) => `**/${p}`);

      for (const pattern of deadPatterns) {
        const result = await workspaceProvider.findFiles(pattern);
        if (result.kind === "ok") {
          for (const f of result.value) {
            if (!deadFiles.includes(f) && !isExcluded(f, excludePatterns)) {
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
            if (!logFiles.includes(f) && !isExcluded(f, excludePatterns)) {
              logFiles.push(f);
            }
          }
        }
      }

      // --- Large files: read content to measure size, skip excluded paths ---
      const largeFiles: Array<{ path: string; sizeBytes: number }> = [];
      const allFilesResult = await workspaceProvider.findFiles("**/*");

      if (allFilesResult.kind === "ok") {
        for (const filePath of allFilesResult.value) {
          if (isExcluded(filePath, excludePatterns)) {
            continue;
          }
          const readResult = await workspaceProvider.readFile(filePath);
          if (readResult.kind === "ok") {
            const sizeBytes = Buffer.byteLength(readResult.value, "utf8");
            if (sizeBytes > HYGIENE_SETTINGS.MAX_FILE_SIZE_BYTES) {
              largeFiles.push({ path: filePath, sizeBytes });
            }
          }
        }
      }

      // --- Markdown files: collect all .md files with size + line count ---
      const markdownFiles: MarkdownFile[] = [];
      const mdResult = await workspaceProvider.findFiles("**/*.md");
      if (mdResult.kind === "ok") {
        for (const filePath of mdResult.value) {
          if (isExcluded(filePath, excludePatterns)) continue;
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

      const scan: WorkspaceScan = {
        deadFiles,
        largeFiles,
        logFiles,
        markdownFiles,
        deadCode,
      };

      logger.info(
        `Found ${scan.deadFiles.length} dead, ${scan.largeFiles.length} large, ${scan.logFiles.length} log, ${scan.markdownFiles.length} markdown, ${scan.deadCode.items.length} dead-code items`,
        "HygieneScanHandler"
      );

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
