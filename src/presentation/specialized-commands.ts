/**
 * Specialized Commands — workflow.run, hygiene file actions, impactAnalysis.
 *
 * These commands need custom argument handling (TreeItem resolution, InputBox
 * prompts, confirmation dialogs) that can't be expressed as a simple
 * COMMAND_MAP entry.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as nodePath from "path";
import { CommandRouter } from "../router";
import { CommandContext } from "../types";
import { selectModel } from "../infrastructure/model-selector";
import { RunWorkflowResult } from "../domains/workflow/types";
import { WorkflowTreeProvider } from "../ui/tree-providers/workflow-tree-provider";
import { HygieneTreeProvider } from "../ui/tree-providers/hygiene-tree-provider";

export function registerSpecializedCommands(
  context: vscode.ExtensionContext,
  router: CommandRouter,
  outputChannel: vscode.OutputChannel,
  getCommandContext: () => CommandContext,
  workflowTree: WorkflowTreeProvider,
  hygieneTree: HygieneTreeProvider
): void {
  // ── workflow.run ───────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "meridian.workflow.run",
      async (arg: unknown = {}) => {
        const freshCtx = getCommandContext();
        let name: string | undefined;

        if (arg && typeof arg === "object") {
          const obj = arg as Record<string, unknown>;
          if (typeof obj.name === "string" && obj.name) {
            name = obj.name;
          } else if (typeof obj.label === "string" && obj.label) {
            name = obj.label;
          }
        }

        if (!name) {
          vscode.window.showErrorMessage("No workflow selected.");
          return;
        }

        workflowTree.setRunning(name);
        const result = await router.dispatch({ name: "workflow.run", params: { name } }, freshCtx);
        const r = result.kind === "ok" ? (result.value as RunWorkflowResult) : null;
        workflowTree.setLastRun(name, r?.success ?? false, r?.duration ?? 0, r?.stepResults ?? []);

        const HR = "─".repeat(60);
        const ts = new Date().toISOString();

        if (result.kind === "ok" && r) {
          outputChannel.show(true);
          outputChannel.appendLine(`\n${HR}`);
          outputChannel.appendLine(`[${ts}] Workflow: ${r.workflowName} — ${r.stepCount} step(s) in ${(r.duration / 1000).toFixed(2)}s`);
          outputChannel.appendLine(HR);
          for (const step of r.stepResults) {
            const icon = step.success ? "✓" : "✗";
            const detail = step.error ? `: ${step.error}` : "";
            outputChannel.appendLine(`  ${icon} ${step.stepId}${detail}`);
          }
          outputChannel.appendLine("");

          if (r.success) {
            vscode.window.showInformationMessage(
              `Workflow "${r.workflowName}" completed — ${r.stepCount} step(s) in ${(r.duration / 1000).toFixed(1)}s`
            );
          } else {
            vscode.window.showErrorMessage(
              `Workflow "${r.workflowName}" failed at step "${r.failedAt}" — see Output`,
              "Show Output"
            ).then((choice) => { if (choice === "Show Output") outputChannel.show(true); });
          }
        } else if (result.kind === "err") {
          const details = result.error.details as any;
          outputChannel.show(true);
          outputChannel.appendLine(`\n${HR}`);
          outputChannel.appendLine(`[${ts}] Workflow: ${name} — FAILED`);
          outputChannel.appendLine(HR);
          outputChannel.appendLine(`  ✗ ${result.error.message}`);
          if (details?.failedAt) outputChannel.appendLine(`  Failed at: ${details.failedAt}`);
          outputChannel.appendLine("");
          vscode.window.showErrorMessage(
            `Workflow "${name}" failed — see Output`,
            "Show Output"
          ).then((choice) => { if (choice === "Show Output") outputChannel.show(true); });
        }
      }
    )
  );

  // ── Hygiene file actions ──────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("meridian.hygiene.deleteFile", async (item: any) => {
      const filePath: string | undefined =
        item instanceof vscode.Uri ? item.fsPath : item?.filePath;
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

    vscode.commands.registerCommand("meridian.hygiene.ignoreFile", async (item: any) => {
      const filePath: string | undefined =
        item instanceof vscode.Uri ? item.fsPath : item?.filePath;
      if (!filePath) return;
      const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
      const ignorePath = nodePath.join(wsRoot, ".meridianignore");
      const pattern = nodePath.relative(wsRoot, filePath);
      fs.appendFileSync(ignorePath, `\n${pattern}\n`);
      vscode.window.showInformationMessage(`Added to .meridianignore: ${pattern}`);
      hygieneTree.refresh();
    }),

    vscode.commands.registerCommand("meridian.hygiene.reviewFile", async (item: any) => {
      const filePath: string | undefined =
        item instanceof vscode.Uri ? item.fsPath : item?.filePath;
      if (!filePath) return;

      let content: string;
      try {
        content = fs.readFileSync(filePath, "utf-8");
      } catch {
        vscode.window.showErrorMessage(`Could not read: ${nodePath.basename(filePath)}`);
        return;
      }

      const model = await selectModel("hygiene");
      if (!model) {
        vscode.window.showErrorMessage("No language model available. Ensure GitHub Copilot is enabled.");
        return;
      }

      const filename = nodePath.basename(filePath);
      outputChannel.show(true);
      outputChannel.appendLine(`\n${"─".repeat(60)}`);
      outputChannel.appendLine(`[${new Date().toISOString()}] AI Review: ${filename}`);
      outputChannel.appendLine("─".repeat(60));

      const messages = [
        vscode.LanguageModelChatMessage.User(
          `You are a critical technical reviewer. Analyze this Markdown document and provide concise, actionable feedback on:\n1. Content accuracy and factual correctness\n2. Clarity and readability\n3. Completeness (gaps or missing context)\n4. Effectiveness (does it achieve its purpose?)\n5. Top 3 specific improvements\n\nDocument: ${filename}\n\`\`\`markdown\n${content}\n\`\`\``
        ),
      ];

      try {
        const cts = new vscode.CancellationTokenSource();
        context.subscriptions.push(cts);
        const response = await model.sendRequest(messages, {}, cts.token);
        for await (const fragment of response.text) {
          outputChannel.append(fragment);
        }
        outputChannel.appendLine("\n");
      } catch (err) {
        outputChannel.appendLine(`[Error] Review failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }),
  );

  // ── hygiene.impactAnalysis ────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("meridian.hygiene.impactAnalysis", async (item: any) => {
      const filePath: string | undefined =
        item instanceof vscode.Uri ? item.fsPath :
        item?.filePath ??
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

      const result = await router.dispatch({ name: "hygiene.impactAnalysis", params }, freshCtx);
      if (result.kind === "ok") {
        const val = result.value as any;
        outputChannel.show(true);
        outputChannel.appendLine(`\n${"─".repeat(60)}`);
        outputChannel.appendLine(`[${new Date().toISOString()}] Impact Analysis: ${nodePath.basename(filePath)}`);
        outputChannel.appendLine("─".repeat(60));
        outputChannel.appendLine(val.summary ?? "No summary available.");
        outputChannel.appendLine("");
        await vscode.env.clipboard.writeText(val.summary ?? "");
        vscode.window.showInformationMessage("Impact analysis copied to clipboard.");
      } else {
        vscode.window.showErrorMessage(`Impact Analysis failed: ${result.error.message}`);
      }
    }),
  );
}
