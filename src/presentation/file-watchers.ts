/**
 * File Watchers — auto-refresh tree views on workspace changes.
 */

import * as vscode from "vscode";
import { UI_SETTINGS } from "../constants";

function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

export interface RefreshTargets {
  gitRefresh: () => void;
  hygieneRefresh: () => void;
  statusBarUpdate: () => void;
}

/**
 * Register file-system watchers that auto-refresh tree views.
 */
export function setupFileWatchers(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  targets: RefreshTargets
): void {
  const debouncedGitRefresh = debounce(() => {
    targets.gitRefresh();
    targets.statusBarUpdate();
  }, UI_SETTINGS.WATCHER_DEBOUNCE_MS);

  const debouncedHygieneRefresh = debounce(() => {
    targets.hygieneRefresh();
  }, UI_SETTINGS.WATCHER_DEBOUNCE_MS);

  // Git state: branch switches, staging, commits
  const gitWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceRoot, ".git/{HEAD,index,refs/**}")
  );
  gitWatcher.onDidChange(debouncedGitRefresh);
  gitWatcher.onDidCreate(debouncedGitRefresh);

  // Workspace files: create/delete affects hygiene scan
  const fileWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceRoot, "**/*")
  );
  fileWatcher.onDidCreate(debouncedHygieneRefresh);
  fileWatcher.onDidDelete(debouncedHygieneRefresh);

  context.subscriptions.push(gitWatcher, fileWatcher);
}
