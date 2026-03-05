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
import { AnalyticsWebviewProvider, HygieneAnalyticsWebviewProvider } from "../infrastructure/webview-provider";

export interface PresenterContext {
  outputChannel: vscode.OutputChannel;
  analyticsPanel: AnalyticsWebviewProvider;
  hygieneAnalyticsPanel: HygieneAnalyticsWebviewProvider;
}

const HR = "─".repeat(60);

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

  const { outputChannel, analyticsPanel, hygieneAnalyticsPanel } = ctx;

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
      const pr = result.value as any;
      outputChannel.show(true);
      outputChannel.appendLine(`\n${HR}`);
      outputChannel.appendLine(`[${ts()}] PR Description: ${pr.branch}`);
      outputChannel.appendLine(HR);
      outputChannel.appendLine(pr.body);
      outputChannel.appendLine("");
      await vscode.env.clipboard.writeText(pr.body);
      vscode.window.showInformationMessage(`PR description copied to clipboard (${pr.branch})`);
      return true;
    }

    case "git.reviewPR": {
      const rv = result.value as any;
      outputChannel.show(true);
      outputChannel.appendLine(`\n${HR}`);
      outputChannel.appendLine(`[${ts()}] PR Review: ${rv.branch} — ${rv.verdict}`);
      outputChannel.appendLine(HR);
      outputChannel.appendLine(`\n${rv.summary}\n`);
      for (const c of rv.comments ?? []) {
        outputChannel.appendLine(`[${c.severity}] ${c.file}: ${c.comment}`);
      }
      outputChannel.appendLine("");
      const text = `${rv.summary}\n\n${(rv.comments ?? []).map((c: any) => `[${c.severity}] ${c.file}: ${c.comment}`).join("\n")}`;
      await vscode.env.clipboard.writeText(text);
      vscode.window.showInformationMessage(`PR review copied to clipboard (${rv.branch}: ${rv.verdict})`);
      return true;
    }

    case "git.commentPR": {
      const cm = result.value as any;
      outputChannel.show(true);
      outputChannel.appendLine(`\n${HR}`);
      outputChannel.appendLine(`[${ts()}] PR Comments: ${cm.branch} — ${cm.comments?.length ?? 0} comment(s)`);
      outputChannel.appendLine(HR);
      for (const c of cm.comments ?? []) {
        const loc = c.line ? `:${c.line}` : "";
        outputChannel.appendLine(`${c.file}${loc}: ${c.comment}`);
      }
      outputChannel.appendLine("");
      const cmText = (cm.comments ?? []).map((c: any) => `${c.file}${c.line ? `:${c.line}` : ""}: ${c.comment}`).join("\n");
      await vscode.env.clipboard.writeText(cmText);
      vscode.window.showInformationMessage(`${cm.comments?.length ?? 0} PR comment(s) copied to clipboard`);
      return true;
    }

    case "git.sessionBriefing": {
      const briefing = result.value as string;
      outputChannel.show(true);
      outputChannel.appendLine(`\n${HR}`);
      outputChannel.appendLine(`[${ts()}] Session Briefing`);
      outputChannel.appendLine(HR);
      outputChannel.appendLine(briefing);
      outputChannel.appendLine("");
      await vscode.env.clipboard.writeText(briefing);
      vscode.window.showInformationMessage("Session briefing copied to clipboard");
      return true;
    }

    case "git.resolveConflicts": {
      const cr = result.value as any;
      outputChannel.show(true);
      outputChannel.appendLine(`\n${HR}`);
      outputChannel.appendLine(`[${ts()}] Conflict Resolution — ${cr.perFile?.length ?? 0} file(s)`);
      outputChannel.appendLine(HR);
      outputChannel.appendLine(`\n${cr.overview}\n`);
      for (const f of cr.perFile ?? []) {
        outputChannel.appendLine(`${f.path} → ${f.strategy}`);
        outputChannel.appendLine(`  ${f.rationale}`);
        for (const step of f.suggestedSteps ?? []) {
          outputChannel.appendLine(`  • ${step}`);
        }
      }
      outputChannel.appendLine("");
      vscode.window.showInformationMessage(`Conflict resolution for ${cr.perFile?.length ?? 0} file(s) — see Output`);
      return true;
    }

    case "chat.delegate": {
      const dr = result.value as any;
      const { message } = formatResultMessage(dr.commandName, { kind: "ok", value: dr.result });
      outputChannel.appendLine(`[${ts()}] Delegated → ${dr.commandName}: ${message}`);
      vscode.window.showInformationMessage(`Delegated → ${dr.commandName}`);
      return true;
    }

    default:
      return false;
  }
}
