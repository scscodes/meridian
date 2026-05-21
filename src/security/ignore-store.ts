/**
 * .meridian/.meridianignore — read and append helpers.
 *
 * Canonical, security-gated I/O for the workspace's ignore file (located at
 * .meridian/.meridianignore per ADR 014). Centralizes:
 *   - pattern read + normalization (was duplicated in hygiene/analytics-service)
 *   - append-with-dedupe (was inline in specialized-commands.ts, no dedupe)
 *   - workspace-boundary enforcement via path-guard on every write
 *
 * File format: one bare relative path per line, blank lines and lines
 * beginning with `#` are ignored. Patterns are normalized at read time to
 * `**\/<pattern>` so micromatch matches both relative and absolute forms
 * (mirrors gitignore semantics).
 */

import * as fs from "fs";
import * as path from "path";
import { Result, success, failure } from "../types";
import { resolveWorkspacePath } from "./path-guard";
import { MERIDIAN_DIR } from "../constants";

const IGNORE_FILE = path.join(MERIDIAN_DIR, ".meridianignore");

export interface IgnoreAppendResult {
  /** The bare relative path written to (or already in) .meridian/.meridianignore. */
  readonly pattern: string;
  /** True if the pattern was already present and no write occurred. */
  readonly alreadyExists: boolean;
  /** Absolute resolved path of the input (file or folder). */
  readonly resolvedPath: string;
}

/**
 * Parse a line-oriented ignore file into micromatch-ready glob patterns.
 * Returns [] if the file is missing or unreadable. Blank/comment lines are
 * dropped; bare paths are wrapped as `** /<path>` so they match anywhere.
 */
function readIgnoreFilePatterns(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"))
      .map((l) => {
        const stripped = l.endsWith("/") ? l.slice(0, -1) : l;
        return stripped.startsWith("**/") ? stripped : `**/${stripped}`;
      });
  } catch {
    return [];
  }
}

/** Parse .meridian/.meridianignore into micromatch-ready glob patterns. */
export function readMeridianIgnorePatterns(workspaceRoot: string): string[] {
  return readIgnoreFilePatterns(path.join(workspaceRoot, IGNORE_FILE));
}

/** Parse .gitignore into micromatch-ready glob patterns. Same shape/semantics as the meridian variant. */
export function readGitignorePatterns(workspaceRoot: string): string[] {
  return readIgnoreFilePatterns(path.join(workspaceRoot, ".gitignore"));
}

/**
 * Read the raw bare patterns currently in .meridian/.meridianignore (no
 * globbing applied) for dedupe comparisons. Mirrors readMeridianIgnorePatterns'
 * blank/comment handling but preserves the on-disk form.
 */
function readRawPatterns(workspaceRoot: string): { lines: Set<string>; raw: string } {
  try {
    const raw = fs.readFileSync(path.join(workspaceRoot, IGNORE_FILE), "utf-8");
    const lines = new Set(
      raw
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith("#"))
    );
    return { lines, raw };
  } catch {
    return { lines: new Set(), raw: "" };
  }
}

/**
 * Best-effort timestamp for cache-busting. Analyzers can fold this into
 * their cache keys so an ignore-file edit invalidates stale entries
 * without an explicit clearCache() handoff. Returns 0 if the file is
 * missing; consumers should treat any change in the returned value as
 * "patterns may have changed".
 */
export function ignoreFileMtimeMs(workspaceRoot: string): number {
  try {
    return fs.statSync(path.join(workspaceRoot, IGNORE_FILE)).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Append a bare relative path to .meridian/.meridianignore.
 *
 * kind="file"   → adds the file's own relative path.
 * kind="folder" → adds the file's parent directory relative path.
 *
 * The path is run through resolveWorkspacePath() first so symlink escapes
 * or `../` traversal are rejected. Existing identical entries are detected
 * and no duplicate is written. The `.meridian/` parent directory is created
 * if missing — first-append in a fresh workspace must not crash.
 *
 * Refuses to add the workspace root itself ("." / "") as a folder pattern,
 * since that would silence every report.
 */
export function appendIgnorePattern(
  workspaceRoot: string,
  candidatePath: string,
  kind: "file" | "folder"
): Result<IgnoreAppendResult> {
  let resolvedPath: string;
  try {
    resolvedPath = resolveWorkspacePath(workspaceRoot, candidatePath);
  } catch (err) {
    return failure({
      code: "PATH_GUARD_BLOCKED",
      message: "Refused to ignore a path outside the workspace.",
      context: "appendIgnorePattern",
      details: err,
    });
  }

  const root = path.resolve(workspaceRoot);
  const rel = path.relative(root, resolvedPath);
  const pattern = kind === "folder" ? path.dirname(rel) : rel;

  if (!pattern || pattern === "." || pattern === path.sep) {
    return failure({
      code: "INVALID_IGNORE_PATTERN",
      message:
        kind === "folder"
          ? "Refusing to ignore the workspace root."
          : "Empty file path cannot be ignored.",
      context: "appendIgnorePattern",
    });
  }

  // Normalize path separators to forward-slash for portable ignore-file
  // entries (matches the convention used elsewhere in the repo and what
  // micromatch expects).
  const normalized = pattern.split(path.sep).join("/");

  const { lines, raw } = readRawPatterns(workspaceRoot);
  if (lines.has(normalized)) {
    return success({ pattern: normalized, alreadyExists: true, resolvedPath });
  }

  const ignorePath = path.join(workspaceRoot, IGNORE_FILE);
  try {
    fs.mkdirSync(path.dirname(ignorePath), { recursive: true });
    const prefix = raw.length > 0 && !raw.endsWith("\n") ? "\n" : "";
    fs.appendFileSync(ignorePath, `${prefix}${normalized}\n`);
  } catch (err) {
    return failure({
      code: "IGNORE_WRITE_FAILED",
      message: `Failed to update .meridian/.meridianignore: ${err instanceof Error ? err.message : String(err)}`,
      context: "appendIgnorePattern",
      details: err,
    });
  }

  return success({ pattern: normalized, alreadyExists: false, resolvedPath });
}
