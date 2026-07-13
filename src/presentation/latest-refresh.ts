/**
 * Headless snapshot refresh (ADR 020 addendum) — recompute all three reports
 * through the router and rewrite `.meridian/latest/` without opening any
 * webview panel. Gives agents (and keybindings/tasks) fresh snapshots on
 * demand instead of waiting for a human to render a report; the Reports tree
 * freshness rows update automatically via onLatestSnapshotWrite.
 */

import * as vscode from "vscode";
import { CommandRouter } from "../router";
import { Command, CommandContext, Logger, Result } from "../types";
import { PruneConfig } from "../domains/hygiene/analytics-types";
import { REPORT_LABELS } from "../report-labels";
import { writeLatestSnapshot, LatestSnapshotKind } from "../infrastructure/latest-snapshot";

export interface LatestRefreshOutcome {
  written: LatestSnapshotKind[];
  failures: Array<{ kind: LatestSnapshotKind; message: string }>;
}

type Dispatch = (cmd: Command, ctx: CommandContext) => Promise<Result<unknown>>;

/**
 * Dispatch each report command and snapshot every success — one report's
 * failure never blocks the others. Sequential, analytics first: the session
 * briefing reads the same analyzer at the same default period (3mo), so it
 * reuses the cache the first dispatch just warmed. Awaits the queued writes,
 * so "written" means the files are on disk when this resolves.
 */
export async function refreshLatestSnapshots(
  workspaceRoot: string,
  dispatch: Dispatch,
  ctx: CommandContext,
  pruneConfig: PruneConfig,
  logger: Logger
): Promise<LatestRefreshOutcome> {
  const jobs: ReadonlyArray<{ kind: LatestSnapshotKind; command: Command }> = [
    { kind: "gitAnalytics",     command: { name: "git.showAnalytics",     params: {} } },
    { kind: "hygieneAnalytics", command: { name: "hygiene.showAnalytics", params: pruneConfig } },
    { kind: "sessionBriefing",  command: { name: "git.sessionBriefing",   params: {} } },
  ];

  const outcome: LatestRefreshOutcome = { written: [], failures: [] };
  for (const { kind, command } of jobs) {
    const result = await dispatch(command, ctx);
    if (result.kind === "ok") {
      await writeLatestSnapshot(workspaceRoot, kind, result.value, logger);
      outcome.written.push(kind);
    } else {
      outcome.failures.push({ kind, message: result.error.message });
    }
  }
  return outcome;
}

export function registerLatestRefreshCommand(
  context: vscode.ExtensionContext,
  router: CommandRouter,
  getCommandContext: () => CommandContext,
  readPruneConfig: () => PruneConfig,
  logger: Logger
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("meridian.latest.refresh", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) {
        void vscode.window.showInformationMessage(
          "Open a workspace folder to refresh Meridian snapshots."
        );
        return;
      }

      const outcome = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Refreshing Meridian snapshots…" },
        () => refreshLatestSnapshots(
          root, (cmd, ctx) => router.dispatch(cmd, ctx), getCommandContext(), readPruneConfig(), logger
        )
      );

      if (outcome.failures.length === 0) {
        void vscode.window.showInformationMessage(
          `Meridian snapshots refreshed (${outcome.written.length}/${outcome.written.length}).`
        );
      } else {
        const detail = outcome.failures
          .map((f) => `${REPORT_LABELS[f.kind]}: ${f.message}`)
          .join("; ");
        void vscode.window.showWarningMessage(
          `Refreshed ${outcome.written.length}/${outcome.written.length + outcome.failures.length} Meridian snapshots — ${detail}`
        );
      }
    })
  );
}
