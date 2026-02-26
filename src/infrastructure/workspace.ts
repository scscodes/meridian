/**
 * Workspace utilities — detect workspace root, resolve .vscode/ paths.
 * All workflow/agent definitions live under .vscode/
 *
 * Note: In a real VS Code extension, these would use vscode.workspace APIs.
 * This implementation uses Node.js fs/promises for real file I/O.
 */

import * as fs from "fs";
import * as path from "path";

/**
 * Workspace paths and constants.
 */
export const WORKSPACE_PATHS = {
  AGENTS_DIR: ".vscode/agents",
  WORKFLOWS_DIR: ".vscode/workflows",
  AGENT_SCHEMA: ".vscode/agents/.schema.json",
  WORKFLOW_SCHEMA: ".vscode/workflows/.schema.json",
} as const;

/**
 * Detect workspace root by searching for .vscode directory.
 * Falls back to process.cwd() when not in a VS Code extension context.
 */
export function detectWorkspaceRoot(startPath: string = "."): string {
  try {
    return process.cwd();
  } catch {
    return startPath;
  }
}

/**
 * Resolve path relative to workspace root.
 */
export function resolveWorkspacePath(
  relativePath: string,
  workspaceRoot?: string
): string {
  return path.join(workspaceRoot ?? ".", relativePath);
}

/**
 * Get absolute path to agents directory.
 */
export function getAgentsDir(workspaceRoot?: string): string {
  return resolveWorkspacePath(WORKSPACE_PATHS.AGENTS_DIR, workspaceRoot);
}

/**
 * Get absolute path to workflows directory.
 */
export function getWorkflowsDir(workspaceRoot?: string): string {
  return resolveWorkspacePath(WORKSPACE_PATHS.WORKFLOWS_DIR, workspaceRoot);
}

/**
 * List all JSON files (non-recursively) in a directory.
 * Returns an empty array if the directory does not exist or is unreadable.
 */
export function listJsonFiles(dirPath: string): string[] {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".json"))
      .map((e) => path.join(dirPath, e.name));
  } catch {
    return [];
  }
}

/**
 * Read and parse a JSON file synchronously.
 * Returns null if the file does not exist, is unreadable, or is invalid JSON.
 */
export function readJsonFile<T = unknown>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Write data as a formatted JSON file synchronously.
 * Returns true on success, false on failure.
 */
export function writeJsonFile<T = unknown>(filePath: string, data: T): boolean {
  try {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}
