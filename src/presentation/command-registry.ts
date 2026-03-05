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
  ["meridian.git.resolveConflicts",    "git.resolveConflicts"],
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
            vscode.window.showErrorMessage(message);
          }
          return;
        }

        const command: Command = { name: commandName, params };
        const result = await router.dispatch(command, cmdCtx);

        const handled = await presentResult(commandName, result, presenterCtx);
        if (handled) return;

        const { level, message } = formatResultMessage(commandName, result);
        outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
        if (level === "info") {
          vscode.window.showInformationMessage(message);
        } else {
          vscode.window.showErrorMessage(message);
        }
      }
    );
    context.subscriptions.push(disposable);
  }
}
