/**
 * Command Registry — maps VS Code command IDs to internal CommandNames
 * and registers them with the dispatch + presentation pipeline.
 */

import * as vscode from "vscode";
import { CommandRouter } from "../router";
import { CommandName, Command, CommandContext } from "../types";
import { formatResultMessage } from "../infrastructure/result-handler";
import { PruneConfig } from "../domains/hygiene/analytics-types";
import { presentResult, PresenterContext } from "./result-presenters";

/** Commands that show a progress notification during dispatch. */
const PROGRESS_COMMANDS: ReadonlySet<CommandName> = new Set([
  "git.generatePR", "git.reviewPR", "git.sessionBriefing",
  "git.showAnalytics", "hygiene.scan",
] as CommandName[]);

const PROGRESS_TITLES: Partial<Record<CommandName, string>> = {
  "git.generatePR": "Generating PR description...",
  "git.reviewPR": "Reviewing branch changes...",
  "git.sessionBriefing": "Generating session briefing...",
  "git.showAnalytics": "Loading git analytics...",
  "hygiene.scan": "Scanning workspace...",
};

/** VS Code command ID → internal CommandName */
export const COMMAND_MAP: ReadonlyArray<[string, CommandName]> = [
  ["meridian.git.status",              "git.status"],
  ["meridian.git.pull",                "git.pull"],
  ["meridian.git.commit",              "git.commit"],
  ["meridian.git.smartCommit",         "git.smartCommit"],
  ["meridian.git.analyzeInbound",      "git.analyzeInbound"],
  ["meridian.hygiene.scan",            "hygiene.scan"],
  ["meridian.hygiene.cleanup",         "hygiene.cleanup"],
  // hygiene.impactAnalysis — dedicated registration (active-file fallback + function name prompt)
  ["meridian.chat.context",            "chat.context"],
  ["meridian.workflow.list",           "workflow.list"],
  ["meridian.agent.list",              "agent.list"],
  ["meridian.agent.execute",           "agent.execute"],
  ["meridian.git.showAnalytics",       "git.showAnalytics"],
  ["meridian.git.exportJson",          "git.exportJson"],
  ["meridian.git.exportCsv",           "git.exportCsv"],
  ["meridian.hygiene.showAnalytics",   "hygiene.showAnalytics"],
  ["meridian.git.generatePR",          "git.generatePR"],
  ["meridian.git.reviewPR",            "git.reviewPR"],
  ["meridian.git.commentPR",           "git.commentPR"],
  // git.resolveConflicts — dedicated registration in specialized-commands.ts (tree expansion hooks)
  ["meridian.git.sessionBriefing",     "git.sessionBriefing"],
  ["meridian.chat.delegate",           "chat.delegate"],
];

/**
 * Register all COMMAND_MAP entries as VS Code commands.
 * Hygiene.showAnalytics injects user prune config before dispatching.
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  router: CommandRouter,
  outputChannel: vscode.OutputChannel,
  getCommandContext: () => CommandContext,
  readPruneConfig: () => PruneConfig,
  presenterCtx: PresenterContext
): void {
  for (const [vsCodeId, commandName] of COMMAND_MAP) {
    const disposable = vscode.commands.registerCommand(
      vsCodeId,
      async (params: Record<string, unknown> = {}) => {
        const cmdCtx = getCommandContext();

        // hygiene.showAnalytics: inject user prune config before dispatching
        if (commandName === "hygiene.showAnalytics") {
          const pruneResult = await router.dispatch(
            { name: "hygiene.showAnalytics", params: readPruneConfig() },
            cmdCtx
          );
          await presentResult(commandName, pruneResult, presenterCtx);
          if (pruneResult.kind !== "ok") {
            const { message } = formatResultMessage(commandName, pruneResult);
            outputChannel.show(true);
            vscode.window.showErrorMessage(message, "Show Output")
              .then(choice => { if (choice === "Show Output") outputChannel.show(true); });
          }
          return;
        }

        const command: Command = { name: commandName, params };
        const doDispatch = () => router.dispatch(command, cmdCtx);
        const result = PROGRESS_COMMANDS.has(commandName)
          ? await vscode.window.withProgress(
              { location: vscode.ProgressLocation.Notification, title: PROGRESS_TITLES[commandName] ?? "Working...", cancellable: false },
              doDispatch
            )
          : await doDispatch();

        const handled = await presentResult(commandName, result, presenterCtx);
        if (handled) return;

        const { level, message } = formatResultMessage(commandName, result);
        outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
        if (level === "info") {
          vscode.window.showInformationMessage(message);
        } else {
          outputChannel.show(true);
          vscode.window.showErrorMessage(message, "Show Output")
            .then(choice => { if (choice === "Show Output") outputChannel.show(true); });
        }
      }
    );
    context.subscriptions.push(disposable);
  }
}
