/**
 * Result Presenters — per-command output strategies for VS Code UI.
 *
 * Each presenter handles the "ok" path of a specific command, formatting
 * the result into OutputChannel + clipboard + notification.
 */

import * as vscode from "vscode";
import { CommandName, Result } from "../types";
import { formatResultMessage } from "../infrastructure/result-handler";
import { GitAnalyticsReport } from "../domains/git/analytics-types";
import { HygieneAnalyticsReport } from "../domains/hygiene/analytics-types";
import { AnalyticsWebviewProvider, HygieneAnalyticsWebviewProvider, SessionBriefingWebviewProvider } from "../infrastructure/webview-provider";
import { GeneratedPR, GeneratedPRReview, GeneratedPRComments, SessionBriefingReport } from "../domains/git/types";
import { UI_SETTINGS } from "../constants";
import { copyWithPolicy } from "../security/operation-policy";

export interface PresenterContext {
  outputChannel: vscode.OutputChannel;
  analyticsPanel: AnalyticsWebviewProvider;
  hygieneAnalyticsPanel: HygieneAnalyticsWebviewProvider;
  sessionBriefingPanel: SessionBriefingWebviewProvider;
}

const HR = "─".repeat(UI_SETTINGS.OUTPUT_HR_LENGTH);

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
      outputChannel.appendLine(`[${ts()}] Analytics panel opened`);
      return true;
    }

    case "hygiene.showAnalytics": {
      await hygieneAnalyticsPanel.openPanel(result.value as HygieneAnalyticsReport);
      outputChannel.appendLine(`[${ts()}] Hygiene analytics panel opened`);
      return true;
    }

    case "git.generatePR": {
      const pr = result.value as GeneratedPR;
      outputChannel.show(true);
      outputChannel.appendLine(`\n${HR}`);
      outputChannel.appendLine(`[${ts()}] PR Description: ${pr.branch}`);
      outputChannel.appendLine(HR);
      outputChannel.appendLine(pr.body);
      outputChannel.appendLine("");
      const copied = await copyWithPolicy(pr.body, `PR description for ${pr.branch}`);
      vscode.window.showInformationMessage(
        copied
          ? `PR description copied to clipboard (${pr.branch})`
          : `PR description ready (${pr.branch})`
      );
      return true;
    }

    case "git.reviewPR": {
      const rv = result.value as GeneratedPRReview;
      outputChannel.show(true);
      outputChannel.appendLine(`\n${HR}`);
      outputChannel.appendLine(`[${ts()}] PR Review: ${rv.branch} — ${rv.verdict}`);
      outputChannel.appendLine(HR);
      outputChannel.appendLine(`\n${rv.summary}\n`);
      for (const c of rv.comments ?? []) {
        outputChannel.appendLine(`[${c.severity}] ${c.file}: ${c.comment}`);
      }
      outputChannel.appendLine("");
      const text = `${rv.summary}\n\n${(rv.comments ?? []).map((c) => `[${c.severity}] ${c.file}: ${c.comment}`).join("\n")}`;
      const copied = await copyWithPolicy(text, `PR review for ${rv.branch}`);
      vscode.window.showInformationMessage(
        copied
          ? `PR review copied to clipboard (${rv.branch}: ${rv.verdict})`
          : `PR review ready (${rv.branch}: ${rv.verdict})`
      );
      return true;
    }

    case "git.commentPR": {
      const cm = result.value as GeneratedPRComments;
      outputChannel.show(true);
      outputChannel.appendLine(`\n${HR}`);
      outputChannel.appendLine(`[${ts()}] PR Comments: ${cm.branch} — ${cm.comments?.length ?? 0} comment(s)`);
      outputChannel.appendLine(HR);
      for (const c of cm.comments ?? []) {
        const loc = c.line ? `:${c.line}` : "";
        outputChannel.appendLine(`${c.file}${loc}: ${c.comment}`);
      }
      outputChannel.appendLine("");
      const cmText = (cm.comments ?? []).map((c) => `${c.file}${c.line ? `:${c.line}` : ""}: ${c.comment}`).join("\n");
      const copied = await copyWithPolicy(cmText, `${cm.comments?.length ?? 0} PR comment(s)`);
      vscode.window.showInformationMessage(
        copied
          ? `${cm.comments?.length ?? 0} PR comment(s) copied to clipboard`
          : `${cm.comments?.length ?? 0} PR comment(s) ready`
      );
      return true;
    }

    case "git.sessionBriefing": {
      const report = result.value as SessionBriefingReport;
      await sessionBriefingPanel.openPanel(report);
      outputChannel.appendLine(`[${ts()}] Session briefing panel opened`);
      const copied = await copyWithPolicy(report.summary, "Session briefing summary");
      vscode.window.showInformationMessage(
        copied
          ? "Session briefing opened — summary copied to clipboard"
          : "Session briefing opened"
      );
      return true;
    }

    // git.resolveConflicts — handled in specialized-commands.ts (tree expansion)

    case "chat.delegate": {
      const dr = result.value as { commandName: string; result: unknown };
      const { message } = formatResultMessage(dr.commandName, { kind: "ok", value: dr.result });
      outputChannel.appendLine(`[${ts()}] Delegated → ${dr.commandName}: ${message}`);
      vscode.window.showInformationMessage(`Delegated → ${dr.commandName}`);
      return true;
    }

    default:
      return false;
  }
}
