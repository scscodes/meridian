/**
 * Result Presenters — per-command output strategies for VS Code UI.
 *
 * Each presenter handles the "ok" path of a specific command, formatting
 * the result into OutputChannel + clipboard + notification.
 */

import * as vscode from "vscode";
import { CommandName, Result } from "../types";
import { GitAnalyticsReport } from "../domains/git/analytics-types";
import { HygieneAnalyticsReport } from "../domains/hygiene/analytics-types";
import { AnalyticsWebviewProvider, HygieneAnalyticsWebviewProvider, SessionBriefingWebviewProvider } from "../infrastructure/webview-provider";
import { SessionBriefingReport } from "../domains/git/types";
import { REPORT_LABELS } from "../report-labels";

export interface PresenterContext {
  outputChannel: vscode.OutputChannel;
  analyticsPanel: AnalyticsWebviewProvider;
  hygieneAnalyticsPanel: HygieneAnalyticsWebviewProvider;
  sessionBriefingPanel: SessionBriefingWebviewProvider;
}

function ts(): string {
  return new Date().toISOString();
}

/**
 * Present command result via the appropriate UI strategy.
 * Returns true if the result was handled by a specialized presenter,
 * false if the caller should use the default notification path.
 */
export async function presentResult(
  commandName: CommandName,
  result: Result<unknown>,
  ctx: PresenterContext
): Promise<boolean> {
  if (result.kind !== "ok") return false;

  const { outputChannel, analyticsPanel, hygieneAnalyticsPanel, sessionBriefingPanel } = ctx;

  switch (commandName) {
    case "git.showAnalytics": {
      await analyticsPanel.openPanel(result.value as GitAnalyticsReport);
      outputChannel.appendLine(`[${ts()}] ${REPORT_LABELS.gitAnalytics} panel opened`);
      return true;
    }

    case "hygiene.showAnalytics": {
      await hygieneAnalyticsPanel.openPanel(result.value as HygieneAnalyticsReport);
      outputChannel.appendLine(`[${ts()}] ${REPORT_LABELS.hygieneAnalytics} panel opened`);
      return true;
    }

    case "git.sessionBriefing": {
      // Panel-opening is the feedback — no success toast, no clipboard prompt.
      // Parity with git.showAnalytics / hygiene.showAnalytics (ADR 006 Rule 5).
      const report = result.value as SessionBriefingReport;
      await sessionBriefingPanel.openPanel(report);
      outputChannel.appendLine(`[${ts()}] ${REPORT_LABELS.sessionBriefing} panel opened`);
      return true;
    }

    default:
      return false;
  }
}
