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
  Logger,
} from "../types";
import { resolveWorkspacePath } from "../security/path-guard";

/**
 * Recoverable-delete capability, injected from the host (main.ts passes
 * vscode.workspace.fs.delete with useTrash) so this module stays vscode-free.
 * Must reject when the file cannot be trashed; the provider then falls back
 * to a permanent unlink.
 */
export type MoveToTrashFn = (absolutePath: string) => Promise<void>;

function fsError(code: string, op: string, filePath: string, err: unknown): AppError {
  return {
    code,
    message: `${op} failed for '${filePath}': ${err instanceof Error ? err.message : String(err)}`,
    context: "WorkspaceProvider",
    details: err,
  };
}

/**
 * Directories never worth descending into. Every consumer's exclude list
 * already filters these out of results; pruning them during the walk avoids
 * traversing the (typically largest) trees in the workspace at all.
 */
const PRUNED_DIRS = new Set([".git", "node_modules"]);

/**
 * Recursively collect all file paths under a directory, applying a simple
 * glob-style include pattern. Supports ** prefix and suffix wildcards only.
 * Does not follow symlinks.
 */
async function collectFiles(
  dir: string,
  pattern: string,
  logger?: Logger
): Promise<string[]> {
  const results: string[] = [];
  const matches = compilePattern(pattern);

  async function walk(current: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      logger?.warn("Workspace traversal failed", "WorkspaceProvider", {
        code: "WORKSPACE_READ_ERROR",
        message: `Failed to read directory: ${current}`,
      });
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!PRUNED_DIRS.has(entry.name)) {
          await walk(fullPath);
        }
      } else if (entry.isFile() && matches(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  await walk(dir);
  return results;
}

/**
 * Compile a minimal glob (leading **, *, and literal strings) into a
 * file-name predicate. Matches against the file name only (not the full path).
 */
function compilePattern(pattern: string): (name: string) => boolean {
  // Strip leading **/ and */ prefixes — matching is against file name
  const base = pattern.replace(/^\*+\//, "");

  if (base === "*" || base === "**") return () => true;

  // Escape regex metacharacters, then expand * → .*
  const escaped = base
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  const regex = new RegExp(`^${escaped}$`);
  return (name: string) => regex.test(name);
}

class RealWorkspaceProvider implements WorkspaceProvider {
  constructor(
    private readonly workspaceRoot: string,
    private readonly logger?: Logger,
    private readonly moveToTrash?: MoveToTrashFn
  ) {}

  async findFiles(pattern: string): Promise<Result<string[]>> {
    try {
      const files = await collectFiles(this.workspaceRoot, pattern, this.logger);
      return success(files);
    } catch (err) {
      return failure(
        fsError("WORKSPACE_NOT_FOUND", "findFiles", this.workspaceRoot, err)
      );
    }
  }

  async readFile(filePath: string): Promise<Result<string>> {
    let resolved: string;
    try {
      resolved = resolveWorkspacePath(this.workspaceRoot, filePath);
    } catch (err) {
      return failure(fsError("FILE_READ_ERROR", "readFile", filePath, err));
    }
    try {
      const content = await fs.readFile(resolved, "utf8");
      return success(content);
    } catch (err) {
      return failure(fsError("FILE_READ_ERROR", "readFile", resolved, err));
    }
  }

  async statFile(filePath: string): Promise<Result<{ sizeBytes: number }>> {
    let resolved: string;
    try {
      resolved = resolveWorkspacePath(this.workspaceRoot, filePath);
    } catch (err) {
      return failure(fsError("FILE_READ_ERROR", "statFile", filePath, err));
    }
    try {
      const stat = await fs.stat(resolved);
      return success({ sizeBytes: stat.size });
    } catch (err) {
      return failure(fsError("FILE_READ_ERROR", "statFile", resolved, err));
    }
  }

  async deleteFile(filePath: string): Promise<Result<void>> {
    // Guard the parent directory (realpath + workspace containment), then
    // unlink the entry itself. Realpathing the full candidate would follow a
    // final-component symlink and delete its target instead of the link.
    let target: string;
    try {
      const abs = path.isAbsolute(filePath)
        ? path.resolve(filePath)
        : path.resolve(this.workspaceRoot, filePath);
      const base = path.basename(abs);
      if (!base || base === "." || base === "..") {
        throw new Error("Invalid delete target");
      }
      const parent = resolveWorkspacePath(this.workspaceRoot, path.dirname(abs));
      target = path.join(parent, base);
    } catch (err) {
      return failure(fsError("FILE_DELETE_ERROR", "deleteFile", filePath, err));
    }
    try {
      const stat = await fs.lstat(target);
      if (stat.isDirectory()) {
        return failure(
          fsError(
            "FILE_DELETE_ERROR",
            "deleteFile",
            target,
            new Error("Refusing to delete a directory")
          )
        );
      }
      // Trash-first: a mis-confirmed delete stays recoverable from the OS
      // trash. Fall back to a permanent unlink where trash is unavailable
      // (e.g. some remote filesystems) so deletion keeps working there.
      if (this.moveToTrash) {
        try {
          await this.moveToTrash(target);
          return success(undefined);
        } catch (trashErr) {
          this.logger?.warn(
            `Trash unavailable for '${target}' (${trashErr instanceof Error ? trashErr.message : String(trashErr)}); deleting permanently`,
            "WorkspaceProvider"
          );
        }
      }
      await fs.unlink(target);
      return success(undefined);
    } catch (err) {
      return failure(fsError("FILE_DELETE_ERROR", "deleteFile", target, err));
    }
  }
}

/**
 * Factory: creates a real WorkspaceProvider for the given workspace root.
 * When `moveToTrash` is supplied, deleteFile is trash-first (recoverable).
 */
export function createWorkspaceProvider(
  workspaceRoot: string,
  logger?: Logger,
  moveToTrash?: MoveToTrashFn
): WorkspaceProvider {
  return new RealWorkspaceProvider(workspaceRoot, logger, moveToTrash);
}
