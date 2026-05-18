/**
 * Reports Tree Provider — first-class, anchored entry points for the webview
 * reports. Static three-row tree (no scanning, no fetching). Rows carry no
 * icon by design; the hover (inline) actions are View and Refresh.
 */

import * as vscode from "vscode";

export type ReportId = "sessionBriefing" | "gitAnalytics" | "hygiene";

/** Display order is the array order in REPORTS below. */
const REPORTS: ReadonlyArray<{ id: ReportId; label: string }> = [
  { id: "sessionBriefing", label: "Session Briefing" },
  { id: "gitAnalytics", label: "Git Analytics" },
  { id: "hygiene", label: "Hygiene" },
];

export class ReportTreeItem extends vscode.TreeItem {
  constructor(public readonly reportId: ReportId, label: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "report";
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
