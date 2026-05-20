/**
 * Tree Setup — register sidebar tree data providers and refresh commands.
 */

import * as vscode from "vscode";
import { Command, CommandContext, GitProvider, Logger, Result } from "../types";
import { GitTreeProvider } from "../ui/tree-providers/git-tree-provider";
import { HygieneTreeProvider } from "../ui/tree-providers/hygiene-tree-provider";
import {
  ReportsTreeProvider,
  ReportTreeItem,
  ReportId,
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
  const reportsTree = new ReportsTreeProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("meridian.reports.view", reportsTree),
    vscode.window.registerTreeDataProvider("meridian.git.view",     gitTree),
    vscode.window.registerTreeDataProvider("meridian.hygiene.view", hygieneTree),
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
    vscode.commands.registerCommand("meridian.reports.open", (item?: ReportTreeItem) => {
      if (!item) return;
      const r = reportMap[item.reportId];
      if (r.panel.isOpen()) r.panel.reveal();
      else void vscode.commands.executeCommand(r.cmd);
    }),
    // Refresh = always re-run/recompute.
    vscode.commands.registerCommand("meridian.reports.refresh", (item?: ReportTreeItem) => {
      if (!item) return;
      void vscode.commands.executeCommand(reportMap[item.reportId].cmd);
    }),
    // Explicit settings cog — host-portable replacement for VS Code's implicit
    // view→extension settings affordance, which Cursor doesn't honor (it falls
    // through to the unfiltered Settings page). Pinning to @ext:scscodes.meridian
    // gives deterministic scoping across VS Code, Cursor, VSCodium, etc.
    vscode.commands.registerCommand("meridian.openSettings", () => {
      void vscode.commands.executeCommand("workbench.action.openSettings", "@ext:scscodes.meridian");
    }),
  );

  return { gitTree, hygieneTree, reportsTree };
}
