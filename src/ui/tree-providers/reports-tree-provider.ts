/**
 * Reports Tree Provider — first-class, anchored entry points for the webview
 * reports. Static three-row tree (no scanning, no fetching).
 *
 * Standard: every webview-report row carries one identical icon
 * (ThemeIcon "graph") so the reports read as a single visual class wherever
 * they surface. Labels omit a "Report" suffix — the section already says it.
 * Hover (inline) actions are View and Refresh.
 */

import * as vscode from "vscode";
import { REPORT_LABELS } from "../../report-labels";

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
  private readonly items: ReportTreeItem[] = REPORTS.map(
    (r) => new ReportTreeItem(r.id, r.label)
  );

  getTreeItem(element: ReportTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ReportTreeItem): ReportTreeItem[] {
    return element ? [] : this.items;
  }
}
