/**
 * Status Bar — Meridian status bar item + QuickPick + refreshAll.
 */

import * as vscode from "vscode";
import { GitProvider } from "../types";

export interface StatusBarHandle {
  update: () => Promise<void>;
}

/**
 * Create and register the Meridian status bar item, the QuickPick
 * handler for clicking it, and the refreshAll command.
 */
export function setupStatusBar(
  context: vscode.ExtensionContext,
  gitProvider: GitProvider,
  refreshAll: () => void
): StatusBarHandle {
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    50
  );
  statusBar.name = "Meridian";
  statusBar.command = "meridian.statusBar.clicked";
  context.subscriptions.push(statusBar);

  async function update(): Promise<void> {
    const status = await gitProvider.status();
    if (status.kind === "ok") {
      const s = status.value;
      const dirty = s.isDirty ? "$(circle-filled)" : "$(check)";
      const changes = s.staged + s.unstaged + s.untracked;
      statusBar.text = changes > 0
        ? `$(source-control) ${s.branch} ${dirty} ${changes}`
        : `$(source-control) ${s.branch} ${dirty}`;
      statusBar.tooltip = [
        `Branch: ${s.branch}`,
        `Staged: ${s.staged}`,
        `Unstaged: ${s.unstaged}`,
        `Untracked: ${s.untracked}`,
        ``,
        `Click for Meridian actions`,
      ].join("\n");
    } else {
      statusBar.text = "$(source-control) Meridian";
      statusBar.tooltip = "Git unavailable — click for Meridian actions";
    }
    statusBar.show();
  }

  // Status bar click → QuickPick with top actions
  context.subscriptions.push(
    vscode.commands.registerCommand("meridian.statusBar.clicked", async () => {
      const pick = await vscode.window.showQuickPick(
        [
          { label: "$(git-commit) Smart Commit",  command: "meridian.git.smartCommit" },
          { label: "$(search) Hygiene Scan",       command: "meridian.hygiene.scan" },
          { label: "$(graph) Git Analytics",       command: "meridian.git.showAnalytics" },
          { label: "$(graph) Hygiene Analytics",   command: "meridian.hygiene.showAnalytics" },
          { label: "$(refresh) Refresh All Views", command: "meridian.refreshAll" },
        ],
        { placeHolder: "Meridian — choose an action" }
      );
      if (pick) {
        vscode.commands.executeCommand((pick as any).command);
      }
    })
  );

  // Refresh All command
  context.subscriptions.push(
    vscode.commands.registerCommand("meridian.refreshAll", () => {
      refreshAll();
      update();
    })
  );

  return { update };
}
