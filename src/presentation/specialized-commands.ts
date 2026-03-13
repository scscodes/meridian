/**
 * Specialized Commands — workflow.run, hygiene file actions, impactAnalysis, git.resolveConflicts.
 *
 * These commands need custom argument handling (TreeItem resolution, InputBox
 * prompts, confirmation dialogs, tree pre/post hooks) that can't be expressed
 * as a simple COMMAND_MAP entry.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as nodePath from "path";
import { CommandRouter } from "../router";
import { CommandContext } from "../types";
import { UI_SETTINGS } from "../constants";
import { selectModel } from "../infrastructure/model-selector";
import { RunWorkflowResult } from "../domains/workflow/types";
import { ConflictResolutionProse } from "../domains/git/types";
import { AgentExecutionResult } from "../domains/agent/types";
import { WorkflowTreeProvider } from "../ui/tree-providers/workflow-tree-provider";
import { HygieneTreeProvider } from "../ui/tree-providers/hygiene-tree-provider";
import { GitTreeProvider } from "../ui/tree-providers/git-tree-provider";

const HR = "─".repeat(UI_SETTINGS.OUTPUT_HR_LENGTH);

export function registerSpecializedCommands(
  context: vscode.ExtensionContext,
  router: CommandRouter,
  outputChannel: vscode.OutputChannel,
  getCommandContext: () => CommandContext,
  workflowTree: WorkflowTreeProvider,
  hygieneTree: HygieneTreeProvider,
  gitTree: GitTreeProvider
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
      outputChannel.appendLine(`\n${HR}`);
      outputChannel.appendLine(`[${new Date().toISOString()}] AI Review: ${filename}`);
      outputChannel.appendLine(HR);

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
        outputChannel.appendLine(`\n${HR}`);
        outputChannel.appendLine(`[${new Date().toISOString()}] Impact Analysis: ${nodePath.basename(filePath)}`);
        outputChannel.appendLine(HR);
        outputChannel.appendLine(val.summary ?? "No summary available.");
        outputChannel.appendLine("");
        await vscode.env.clipboard.writeText(val.summary ?? "");
        hygieneTree.setImpactResult(val);
        vscode.window.showInformationMessage("Impact analysis copied to clipboard — expand in Hygiene view.");
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

  // ── git.resolveConflicts ──────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("meridian.git.resolveConflicts", async () => {
      const freshCtx = getCommandContext();
      const ts = new Date().toISOString();

      gitTree.setConflictRunning();
      const result = await router.dispatch({ name: "git.resolveConflicts", params: {} }, freshCtx);

      if (result.kind === "ok") {
        const cr = result.value as ConflictResolutionProse;
        gitTree.setLastConflictRun(cr);
        await vscode.env.clipboard.writeText(cr.overview);
        vscode.window.showInformationMessage(
          `Conflict resolution for ${cr.perFile?.length ?? 0} file(s) — expand in Git view`
        );
      } else {
        gitTree.setLastConflictRun(null);
        outputChannel.show(true);
        outputChannel.appendLine(`\n${HR}`);
        outputChannel.appendLine(`[${ts}] Conflict Resolution — FAILED`);
        outputChannel.appendLine(HR);
        outputChannel.appendLine(`  ✗ ${result.error.message}`);
        if (result.error.code) outputChannel.appendLine(`  Code: ${result.error.code}`);
        outputChannel.appendLine("");
        vscode.window.showErrorMessage(
          `Conflict resolution failed: ${result.error.message}`,
          "Show Output"
        ).then(choice => { if (choice === "Show Output") outputChannel.show(true); });
      }
    }),
  );

  // ── agent.execute (tree-triggered) ──────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("meridian.agent.run", async (item: any) => {
      const agentId: string | undefined =
        typeof item?.label === "string" ? item.label : undefined;
      if (!agentId) {
        vscode.window.showErrorMessage("No agent selected.");
        return;
      }

      const freshCtx = getCommandContext();

      const listResult = await router.dispatch({ name: "agent.list", params: {} }, freshCtx);
      if (listResult.kind !== "ok") {
        vscode.window.showErrorMessage(`Failed to load agents: ${listResult.error.message}`);
        return;
      }
      const { agents } = listResult.value as { agents: Array<{ id: string; capabilities: string[]; workflowTriggers?: string[] }> };
      const agent = agents.find(a => a.id === agentId);
      if (!agent) {
        vscode.window.showErrorMessage(`Agent "${agentId}" not found.`);
        return;
      }

      const targets: vscode.QuickPickItem[] = [
        ...agent.capabilities.map(c => ({ label: c, description: "command" })),
        ...(agent.workflowTriggers ?? []).map(w => ({ label: w, description: "workflow" })),
      ];

      if (targets.length === 0) {
        vscode.window.showErrorMessage(`Agent "${agentId}" has no capabilities or workflow triggers.`);
        return;
      }

      const picked = targets.length === 1
        ? targets[0]
        : await vscode.window.showQuickPick(targets, {
            title: `Run Agent: ${agentId}`,
            placeHolder: "Select a command or workflow to execute",
          });
      if (!picked) return;

      const params: Record<string, unknown> = { agentId };
      if (picked.description === "workflow") {
        params.targetWorkflow = picked.label;
      } else {
        params.targetCommand = picked.label;
      }

      const result = await router.dispatch({ name: "agent.execute", params }, freshCtx);
      if (result.kind === "ok") {
        const r = result.value as AgentExecutionResult;
        const status = r.success ? "completed" : "failed";
        const target = r.executedCommand ?? r.executedWorkflow ?? "unknown";
        vscode.window.showInformationMessage(
          `Agent "${agentId}" ${status}: ${target} in ${r.durationMs}ms`
        );
      } else {
        outputChannel.appendLine(`\n${HR}`);
        outputChannel.appendLine(`[${new Date().toISOString()}] Agent: ${agentId} — FAILED`);
        outputChannel.appendLine(HR);
        outputChannel.appendLine(`  ✗ ${result.error.message}`);
        outputChannel.appendLine("");
        vscode.window.showErrorMessage(
          `Agent "${agentId}" failed: ${result.error.message}`,
          "Show Output"
        ).then(choice => { if (choice === "Show Output") outputChannel.show(true); });
      }
    }),
  );
}
