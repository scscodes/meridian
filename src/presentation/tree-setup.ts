/**
 * Tree Setup — register sidebar tree data providers and refresh commands.
 */

import * as vscode from "vscode";
import { Command, CommandContext, GitProvider, Logger, Result } from "../types";
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
    // Explicit settings command — host-portable replacement for VS Code's
    // implicit view→extension settings affordance, which Cursor doesn't honor
    // (the click falls through to the unfiltered Settings page). Surfaced as
    // "Open Settings" in each Meridian view's "..." overflow menu (group
    // 1_settings) so VS Code's native title-bar cog isn't visually duplicated;
    // Cursor users get a working entry one extra click away.
    vscode.commands.registerCommand("meridian.openSettings", () => {
      void vscode.commands.executeCommand("workbench.action.openSettings", "@ext:scscodes.meridian");
    }),
    // Meridian Actions kebab — one per view. Distinct $(kebab-vertical) glyph
    // (not gear) so it doesn't visually duplicate the host-synthesized settings
    // cog on either VS Code or Cursor. See ADR 016.
    vscode.commands.registerCommand("meridian.reports.showActions",
      () => showActionsQuickPick("reports")),
    vscode.commands.registerCommand("meridian.git.showActions",
      () => showActionsQuickPick("git")),
    vscode.commands.registerCommand("meridian.hygiene.showActions",
      () => showActionsQuickPick("hygiene")),
  );

  return { gitTree, hygieneTree, reportsTree };
}

type ViewKey = "reports" | "git" | "hygiene";

interface ActionItem extends vscode.QuickPickItem {
  command: string;
}

const VIEW_ACTIONS: Record<ViewKey, ActionItem[]> = {
  reports: [
    { label: "$(gear) Open Settings", command: "meridian.openSettings" },
  ],
  git: [
    { label: "$(refresh) Refresh Git View", command: "meridian.git.refresh" },
    { label: "$(gear) Open Settings",       command: "meridian.openSettings" },
  ],
  hygiene: [
    { label: "$(refresh) Refresh Hygiene View", command: "meridian.hygiene.refresh" },
    { label: "$(gear) Open Settings",           command: "meridian.openSettings" },
  ],
};

/** Exported for unit testing; not intended as a public surface. */
export async function showActionsQuickPick(viewKey: ViewKey): Promise<void> {
  const pick = await vscode.window.showQuickPick(VIEW_ACTIONS[viewKey], {
    placeHolder: `Meridian — ${viewKey} actions`,
  });
  if (pick) await vscode.commands.executeCommand(pick.command);
}
