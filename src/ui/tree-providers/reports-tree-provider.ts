/**
 * Reports Tree Provider — first-class, anchored entry points for the webview
 * reports. Static three-row tree (no scanning, no fetching) plus a coarse
 * freshness description per row, read off the `.meridian/latest/` snapshot
 * mtimes (ADR 020). The tree is an internal, mtime-only consumer of that
 * contract — it never parses the snapshot JSON.
 *
 * Standard: every webview-report row carries one identical icon
 * (ThemeIcon "graph") so the reports read as a single visual class wherever
 * they surface. Labels omit a "Report" suffix — the section already says it.
 * Hover (inline) actions are View and Refresh.
 */

import * as vscode from "vscode";
import { promises as fsp } from "node:fs";
import { REPORT_LABELS } from "../../report-labels";
import { latestSnapshotPath, LatestSnapshotKind } from "../../infrastructure/latest-snapshot";

export type ReportId = "sessionBriefing" | "gitAnalytics" | "hygiene";

/**
 * Minimal shape `meridian.reports.open` reads from its argument. `ReportTreeItem`
 * satisfies this (extends `vscode.TreeItem`, carries `reportId`) — but a plain
 * `{ reportId }` object satisfies it too, which lets the session-briefing webview
 * deep-link without importing `ReportTreeItem` (and hence `vscode.TreeItem`) into
 * a module whose tests mock `vscode` sparsely.
 */
export type ReportOpenArg = { readonly reportId: ReportId };

/** Display order is the array order in REPORTS below. */
const REPORTS: ReadonlyArray<{ id: ReportId; label: string }> = [
  { id: "sessionBriefing", label: REPORT_LABELS.sessionBriefing },
  { id: "gitAnalytics", label: REPORT_LABELS.gitAnalytics },
  { id: "hygiene", label: REPORT_LABELS.hygieneAnalytics },
];

/** ReportId → snapshot kind. Only the tree's `hygiene` row is renamed (`hygieneAnalytics`). */
const REPORT_SNAPSHOT_KIND: Record<ReportId, LatestSnapshotKind> = {
  sessionBriefing: "sessionBriefing",
  gitAnalytics: "gitAnalytics",
  hygiene: "hygieneAnalytics",
};

/**
 * Coarse relative age for a tree-row description. Deliberately minute-grained
 * (no seconds, no live timer): recomputed only on tree redraw and on
 * snapshot-write refresh.
 */
export function formatRelativeAge(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export class ReportTreeItem extends vscode.TreeItem {
  constructor(public readonly reportId: ReportId, label: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "report";
    // Standard: all webview-report rows share one icon for visual consistency.
    this.iconPath = new vscode.ThemeIcon("graph");
    // Single-click default = View (reveal-or-compute).
    this.command = {
      command: "meridian.reports.open",
      title: "View Report",
      arguments: [this],
    };
  }
}

export class ReportsTreeProvider implements vscode.TreeDataProvider<ReportTreeItem> {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  /** No workspace root → rows render without freshness descriptions. */
  constructor(private readonly workspaceRoot?: string) {}

  refresh(): void {
    this.changeEmitter.fire();
  }

  getTreeItem(element: ReportTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ReportTreeItem): Promise<ReportTreeItem[]> {
    if (element) return [];
    const items = REPORTS.map((r) => new ReportTreeItem(r.id, r.label));
    if (!this.workspaceRoot) return items;

    const root = this.workspaceRoot;
    await Promise.all(
      items.map(async (item) => {
        try {
          const stat = await fsp.stat(latestSnapshotPath(root, REPORT_SNAPSHOT_KIND[item.reportId]));
          item.description = formatRelativeAge(Date.now() - stat.mtimeMs);
        } catch {
          // No snapshot yet for this report — leave the description absent.
        }
      })
    );
    return items;
  }
}
