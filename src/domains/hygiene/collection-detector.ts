/**
 * Detect heavy-artifact dirs present in a workspace, bucketed by purpose.
 *
 * Runs a shallow directory walk (depth ≤ MAX_DEPTH) and matches each
 * directory name against COLLECTION_BUCKETS. When a known collection dir
 * is hit, it's recorded and recursion stops at that branch — no point
 * descending into node_modules or .venv.
 *
 * Used by the hygiene scan handler to populate WorkspaceScan.collections
 * so the sidebar tree provider can show parity entries with the webview
 * Collections section. Directly uses fs (not WorkspaceProvider) because
 * we're operating on directory metadata only and the call is bounded.
 */

import * as fs from "fs";
import * as path from "path";
import { CollectionsBreakdown } from "../../types";
import { bucketForDirName } from "./analytics-utils";

/** Walking past depth 3 starts to look like a full scan — bound it tight. */
const MAX_DEPTH = 3;

/** Skip these dir names entirely during the walk (not collections, not interesting). */
const SKIP_DIRS = new Set([".git", ".meridian", ".vscode", ".idea"]);

export function detectCollections(workspaceRoot: string): CollectionsBreakdown {
  const result: CollectionsBreakdown = {
    envs: [],
    caches: [],
    buildOutputs: [],
    vendoredDeps: [],
  };
  walk(workspaceRoot, workspaceRoot, 0, result);
  result.envs.sort();
  result.caches.sort();
  result.buildOutputs.sort();
  result.vendoredDeps.sort();
  return result;
}

function walk(
  dir: string,
  root: string,
  depth: number,
  result: CollectionsBreakdown
): void {
  if (depth > MAX_DEPTH) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const dirent of entries) {
    if (!dirent.isDirectory()) continue;
    if (SKIP_DIRS.has(dirent.name)) continue;
    const fullPath = path.join(dir, dirent.name);
    const relPath = path.relative(root, fullPath).split(path.sep).join("/");
    const bucket = bucketForDirName(dirent.name);
    if (bucket) {
      result[bucket].push(relPath);
      continue;
    }
    walk(fullPath, root, depth + 1, result);
  }
}
