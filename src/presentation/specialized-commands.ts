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
import type { PruneStorageOutcome } from "../domains/hygiene/storage-handler";
import type { StorageStatus } from "../infrastructure/retention";

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
        { name: "hygiene.cleanup", params: { files: [filePath] } }, freshCtx
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
      const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
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

    // ── hygiene.pruneStorage (ADR 019) — status → confirm → prune → toast ──
    vscode.commands.registerCommand("meridian.hygiene.pruneStorage", async () => {
      const freshCtx = getCommandContext();

      const statusResult = await router.dispatch(
        { name: "hygiene.storageStatus", params: {} }, freshCtx
      );
      if (statusResult.kind === "err") {
        vscode.window.showErrorMessage(`Storage status failed: ${statusResult.error.message}`);
        return;
      }
      const status = statusResult.value as StorageStatus;
      const overCap = status.policy.runLogMaxEvents > 0
        ? Math.max(0, status.runLog.lineCount - status.policy.runLogMaxEvents)
        : 0;

      if (status.artifacts.wouldPruneCount === 0 && overCap === 0) {
        vscode.window.showInformationMessage(
          "Meridian storage is within policy — nothing to prune."
        );
        return;
      }

      const mb = (status.artifacts.wouldPruneBytes / (1024 * 1024)).toFixed(2);
      const parts: string[] = [];
      if (status.artifacts.wouldPruneCount > 0) {
        parts.push(`${status.artifacts.wouldPruneCount} exported report(s) (${mb} MB)`);
      }
      if (overCap > 0) {
        parts.push(`${overCap} run-log event(s)`);
      }
      const confirm = await vscode.window.showWarningMessage(
        `Prune Meridian storage? This removes ${parts.join(" and ")} per the current retention settings.`,
        { modal: true }, "Prune"
      );
      if (confirm !== "Prune") return;

      const result = await router.dispatch(
        { name: "hygiene.pruneStorage", params: {} }, freshCtx
      );
      if (result.kind === "ok") {
        const outcome = result.value as PruneStorageOutcome;
        const freedMb = (outcome.artifacts.freedBytes / (1024 * 1024)).toFixed(2);
        vscode.window.showInformationMessage(
          `Pruned ${outcome.artifacts.deletedCount} report(s) (${freedMb} MB), ` +
            `compacted ${outcome.runLogDropped} run-log event(s).`
        );
        hygieneTree.refresh();
      } else {
        vscode.window.showErrorMessage(`Prune failed: ${result.error.message}`);
      }
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
