/**
 * Real WorkspaceProvider implementation using Node.js fs/promises.
 * Implements the WorkspaceProvider interface from types.ts.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { Dirent } from "fs";
import {
  WorkspaceProvider,
  Result,
  success,
  failure,
  AppError,
} from "../types";

function fsError(code: string, op: string, filePath: string, err: unknown): AppError {
  return {
    code,
    message: `${op} failed for '${filePath}': ${err instanceof Error ? err.message : String(err)}`,
    context: "WorkspaceProvider",
    details: err,
  };
}

/**
 * Recursively collect all file paths under a directory, applying a simple
 * glob-style include pattern. Supports ** prefix and suffix wildcards only.
 * Does not follow symlinks.
 */
async function collectFiles(
  dir: string,
  pattern: string
): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return; // directory unreadable — skip silently
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && matchesPattern(entry.name, pattern)) {
        results.push(fullPath);
      }
    }
  }

  await walk(dir);
  return results;
}

/**
 * Minimal glob pattern matching: supports leading **, *, and literal strings.
 * Matches against the file name only (not the full path).
 */
function matchesPattern(name: string, pattern: string): boolean {
  // Strip leading **/ and */ prefixes — matching is against file name
  const base = pattern.replace(/^\*+\//, "");

  if (base === "*" || base === "**") return true;

  // Convert simple glob to regex: * → .*, . → \.
  const escaped = base.replace(/\./g, "\\.").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(name);
}

class RealWorkspaceProvider implements WorkspaceProvider {
  constructor(private readonly workspaceRoot: string) {}

  async findFiles(pattern: string): Promise<Result<string[]>> {
    try {
      const files = await collectFiles(this.workspaceRoot, pattern);
      return success(files);
    } catch (err) {
      return failure(
        fsError("WORKSPACE_NOT_FOUND", "findFiles", this.workspaceRoot, err)
      );
    }
  }

  async readFile(filePath: string): Promise<Result<string>> {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.workspaceRoot, filePath);
    try {
      const content = await fs.readFile(resolved, "utf8");
      return success(content);
    } catch (err) {
      return failure(fsError("FILE_READ_ERROR", "readFile", resolved, err));
    }
  }

  async deleteFile(filePath: string): Promise<Result<void>> {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.workspaceRoot, filePath);
    try {
      await fs.unlink(resolved);
      return success(undefined);
    } catch (err) {
      return failure(fsError("FILE_DELETE_ERROR", "deleteFile", resolved, err));
    }
  }
}

/**
 * Factory: creates a real WorkspaceProvider for the given workspace root.
 */
export function createWorkspaceProvider(workspaceRoot: string): WorkspaceProvider {
  return new RealWorkspaceProvider(workspaceRoot);
}
