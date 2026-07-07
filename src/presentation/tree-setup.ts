/**
 * Tree Setup — register sidebar tree data providers and refresh commands.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Command, CommandContext, GitProvider, Logger, Result } from "../types";
import { MERIDIAN_DIR, MERIDIAN_LATEST_DIR } from "../constants";
import { onLatestSnapshotWrite } from "../infrastructure/latest-snapshot";
import { GitTreeProvider } from "../ui/tree-providers/git-tree-provider";
import { HygieneTreeProvider } from "../ui/tree-providers/hygiene-tree-provider";
import {
  ReportsTreeProvider,
  ReportId,
  ReportOpenArg,
} from "../ui/tree-providers/reports-tree-provider";

export type Dispatch = (cmd: Command, ctx: CommandContext) => Promise<Result<unknown>>;

/** Minimal surface the reports view needs from a webview panel provider. */
export interface RevealablePanel {
  isOpen(): boolean;
  reveal(): void;
}

export interface ReportPanels {
  analyticsPanel: RevealablePanel;
  hygieneAnalyticsPanel: RevealablePanel;
  sessionBriefingPanel: RevealablePanel;
}

export interface TreeProviders {
  gitTree: GitTreeProvider;
  hygieneTree: HygieneTreeProvider;
  reportsTree: ReportsTreeProvider;
}

export function setupTreeProviders(
  context: vscode.ExtensionContext,
  gitProvider: GitProvider,
  logger: Logger,
  workspaceRoot: string,
  dispatch: Dispatch,
  cmdCtx: CommandContext,
  reportPanels: ReportPanels
): TreeProviders {
  const gitTree     = new GitTreeProvider(gitProvider, logger, workspaceRoot);
  const hygieneTree = new HygieneTreeProvider(dispatch, cmdCtx, logger);
  // Real workspace folder only (not the cwd fallback in workspaceRoot):
  // without one there are no snapshots, so rows render without freshness.
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const reportsTree = new ReportsTreeProvider(workspaceFolder);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("meridian.reports.view", reportsTree),
    vscode.window.registerTreeDataProvider("meridian.git.view",     gitTree),
    vscode.window.registerTreeDataProvider("meridian.hygiene.view", hygieneTree),
    // Freshness: redraw the Reports rows whenever a latest snapshot lands, so
    // "updated Nm ago" descriptions track renders without any live timer.
    { dispose: onLatestSnapshotWrite(() => reportsTree.refresh()) },
  );

  // reportId → underlying VS Code command + its webview panel provider.
  const reportMap: Record<ReportId, { cmd: string; panel: RevealablePanel }> = {
    sessionBriefing: { cmd: "meridian.git.sessionBriefing",   panel: reportPanels.sessionBriefingPanel },
    gitAnalytics:    { cmd: "meridian.git.showAnalytics",     panel: reportPanels.analyticsPanel },
    hygiene:         { cmd: "meridian.hygiene.showAnalytics", panel: reportPanels.hygieneAnalyticsPanel },
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("meridian.git.refresh",     () => gitTree.refresh()),
    vscode.commands.registerCommand("meridian.hygiene.refresh", () => hygieneTree.refresh()),
    // View = reveal-or-compute: focus a live panel without recompute, else run it.
    vscode.commands.registerCommand("meridian.reports.open", (item?: ReportOpenArg) => {
      if (!item) return;
      const r = reportMap[item.reportId];
      if (r.panel.isOpen()) r.panel.reveal();
      else void vscode.commands.executeCommand(r.cmd);
    }),
    // Refresh = always re-run/recompute.
    vscode.commands.registerCommand("meridian.reports.refresh", (item?: ReportOpenArg) => {
      if (!item) return;
      void vscode.commands.executeCommand(reportMap[item.reportId].cmd);
    }),
    // Surface the on-disk ADR 020 snapshots to humans. Reveal-if-present;
    // otherwise explain how they come into being.
    vscode.commands.registerCommand("meridian.latest.reveal", () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const latestDir = root ? path.join(root, MERIDIAN_DIR, MERIDIAN_LATEST_DIR) : null;
      if (latestDir && fs.existsSync(latestDir)) {
        void vscode.commands.executeCommand("revealInExplorer", vscode.Uri.file(latestDir));
      } else {
        void vscode.window.showInformationMessage(
          "No snapshots yet — open any Meridian report to generate them."
        );
      }
    }),
    // Branded "Meridian Settings" title action — host-portable replacement for
    // VS Code's implicit view→extension settings cog, which Cursor doesn't honor
    // (its click falls through to Cursor's top-level settings). Contributed to
    // each view's title bar (package.json view/title) with the Meridian brand
    // glyph + "Meridian Settings" label so it reads as distinct from the host
    // cog rather than duplicating it, and filters Settings to this extension.
    // See ADR 016.
    vscode.commands.registerCommand("meridian.openSettings", () => {
      void vscode.commands.executeCommand("workbench.action.openSettings", "@ext:scscodes.meridian");
    }),
  );

  return { gitTree, hygieneTree, reportsTree };
}
