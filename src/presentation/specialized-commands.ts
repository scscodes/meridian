/**
 * Specialized Commands — hygiene file actions and impactAnalysis.
 *
 * These commands need custom argument handling (TreeItem resolution, InputBox
 * prompts, confirmation dialogs) that can't be expressed as a simple
 * COMMAND_MAP entry.
 */

import * as vscode from "vscode";
import * as nodePath from "path";
import { CommandRouter } from "../router";
import { CommandContext } from "../types";
import { UI_SETTINGS } from "../constants";
import { HygieneTreeProvider } from "../ui/tree-providers/hygiene-tree-provider";
import { copyWithPolicy } from "../security/operation-policy";
import { appendIgnorePattern } from "../security/ignore-store";
import type { ImpactAnalysisResult } from "../domains/hygiene/impact-analysis-handler";

const HR = "─".repeat(UI_SETTINGS.OUTPUT_HR_LENGTH);

type FileActionItem = vscode.Uri | { filePath?: string } | undefined;

function extractFilePath(item: FileActionItem): string | undefined {
  if (item instanceof vscode.Uri) return item.fsPath;
  return item?.filePath;
}

export function registerSpecializedCommands(
  context: vscode.ExtensionContext,
  router: CommandRouter,
  outputChannel: vscode.OutputChannel,
  getCommandContext: () => CommandContext,
  hygieneTree: HygieneTreeProvider
): void {
  // ── Hygiene file actions ──────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("meridian.hygiene.deleteFile", async (item: FileActionItem) => {
      const filePath = extractFilePath(item);
      if (!filePath) return;
      const filename = nodePath.basename(filePath);
      const confirm = await vscode.window.showWarningMessage(
        `Delete "${filename}"? This cannot be undone.`,
        { modal: true }, "Delete"
      );
      if (confirm !== "Delete") return;
      const freshCtx = getCommandContext();
      const result = await router.dispatch(
        { name: "hygiene.cleanup", params: { files: [filePath], dryRun: false } }, freshCtx
      );
      if (result.kind === "ok") {
        vscode.window.showInformationMessage(`Deleted: ${filename}`);
        hygieneTree.refresh();
      } else {
        vscode.window.showErrorMessage(`Delete failed: ${result.error.message}`);
      }
    }),

    vscode.commands.registerCommand("meridian.hygiene.ignoreFile", async (item: FileActionItem) => {
      const filePath = extractFilePath(item);
      if (!filePath) return;
      const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!wsRoot) {
        vscode.window.showErrorMessage("Open a workspace folder to use Meridian ignore patterns.");
        return;
      }
      const result = appendIgnorePattern(wsRoot, filePath, "file");
      if (result.kind === "err") {
        vscode.window.showErrorMessage(result.error.message);
        return;
      }
      vscode.window.showInformationMessage(
        result.value.alreadyExists
          ? `Already in .meridian/.meridianignore: ${result.value.pattern}`
          : `Added to .meridian/.meridianignore: ${result.value.pattern}`
      );
      hygieneTree.refresh();
    }),
  );

  // ── hygiene.impactAnalysis ────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("meridian.hygiene.impactAnalysis", async (item: FileActionItem) => {
      const filePath =
        extractFilePath(item) ??
        vscode.window.activeTextEditor?.document.uri.fsPath;

      if (!filePath) {
        vscode.window.showErrorMessage("Impact Analysis: open a TypeScript file first.");
        return;
      }

      const functionName = await vscode.window.showInputBox({
        prompt: "Function or symbol to trace (leave blank to analyze the whole file)",
        placeHolder: "e.g. createStatusHandler",
      });
      if (functionName === undefined) return;

      const freshCtx = getCommandContext();
      const params: Record<string, unknown> = { filePath };
      if (functionName) params.functionName = functionName;

      const result = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Analyzing impact...", cancellable: false },
        () => router.dispatch({ name: "hygiene.impactAnalysis", params }, freshCtx)
      );
      if (result.kind === "ok") {
        const val = result.value as ImpactAnalysisResult;
        outputChannel.show(true);
        outputChannel.appendLine(`\n${HR}`);
        outputChannel.appendLine(`[${new Date().toISOString()}] Impact Analysis: ${nodePath.basename(filePath)}`);
        outputChannel.appendLine(HR);
        outputChannel.appendLine(val.summary ?? "No summary available.");
        outputChannel.appendLine("");
        const copied = await copyWithPolicy(val.summary ?? "", "Impact analysis summary");
        hygieneTree.setImpactResult(val);
        vscode.window.showInformationMessage(
          copied
            ? "Impact analysis copied to clipboard — expand in Hygiene view."
            : "Impact analysis ready — expand in Hygiene view."
        );
      } else {
        outputChannel.appendLine(`\n${HR}`);
        outputChannel.appendLine(`[${new Date().toISOString()}] Impact Analysis — FAILED`);
        outputChannel.appendLine(HR);
        outputChannel.appendLine(`  ✗ ${result.error.message}`);
        if (result.error.code) outputChannel.appendLine(`  Code: ${result.error.code}`);
        outputChannel.appendLine("");
        vscode.window.showErrorMessage(
          `Impact Analysis failed: ${result.error.message}`,
          "Show Output"
        ).then(choice => { if (choice === "Show Output") outputChannel.show(true); });
      }
    }),
  );
}
