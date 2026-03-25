/**
 * Workflow Tree Provider — lists available workflows in the sidebar.
 * Each item has an inline "run" command for one-click execution.
 * Supports running/last-run state indicators per workflow, with
 * expandable step children after a run completes (ADR 007).
 */

import * as vscode from "vscode";
import { Command, CommandContext, Logger, Result } from "../../types";
import { StepResult } from "../../domains/workflow/types";

type Dispatcher = (cmd: Command, ctx: CommandContext) => Promise<Result<unknown>>;

interface WorkflowSummary {
  name: string;
  description?: string;
  version?: string;
  stepCount: number;
}

class WorkflowTreeItem extends vscode.TreeItem {
  constructor(
    public readonly workflowName: string,   // typed property — used for Map lookups, not label cast
    label: string,
    public readonly itemKind: "root" | "workflow",
    collapsible: vscode.TreeItemCollapsibleState,
    description?: string
  ) {
    super(label, collapsible);
    this.description = description;
    this.contextValue = itemKind;
  }
}

class WorkflowStepTreeItem extends vscode.TreeItem {
  constructor(public readonly step: StepResult) {
    super(step.stepId, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(step.success ? "pass" : "error");
    const retryNote = (step.attempts ?? 1) > 1 ? ` (${step.attempts} attempts)` : "";
    const errorText = step.timedOut ? "timed out" : (step.error ?? (step.success ? "" : "failed"));
    this.description = step.success ? retryNote.trim() : `${errorText}${retryNote}`;
    this.contextValue = "workflowStep";
  }
}

type TreeElement = WorkflowTreeItem | WorkflowStepTreeItem;

export class WorkflowTreeProvider implements vscode.TreeDataProvider<TreeElement> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeElement | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // Cache workflow data separately from tree items so state changes rebuild items cheaply
  private cachedWorkflows: WorkflowSummary[] | null = null;

  // Per-workflow execution state
  private runningSet = new Set<string>();
  private lastRuns = new Map<string, { success: boolean; duration: number; stepResults: StepResult[] }>();

  constructor(
    private readonly dispatch: Dispatcher,
    private readonly ctx: CommandContext,
    private readonly logger: Logger
  ) {}

  refresh(): void {
    this.cachedWorkflows = null;
    this._onDidChangeTreeData.fire();
  }

  /** Called when a workflow starts executing. Clears stale step children to prevent showing old data during the new run. */
  setRunning(name: string): void {
    this.runningSet.add(name);
    const prev = this.lastRuns.get(name);
    if (prev) this.lastRuns.set(name, { ...prev, stepResults: [] });
    this._onDidChangeTreeData.fire();
  }

  /** Called when a workflow finishes. Stores step results for tree expansion. */
  setLastRun(name: string, success: boolean, duration: number, stepResults: StepResult[]): void {
    this.runningSet.delete(name);
    this.lastRuns.set(name, { success, duration, stepResults });
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeElement): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeElement): Promise<TreeElement[]> {
    if (!element) return this.getRootItems();

    // Workflow items expand to show per-step results
    if (element instanceof WorkflowTreeItem && element.itemKind === "workflow") {
      const run = this.lastRuns.get(element.workflowName);
      return (run?.stepResults ?? []).map(s => new WorkflowStepTreeItem(s));
    }

    return [];
  }

  private async getRootItems(): Promise<WorkflowTreeItem[]> {
    // Fetch workflow list only if not cached (refresh() clears this)
    if (!this.cachedWorkflows) {
      const result = await this.dispatch({ name: "workflow.list", params: {} }, this.ctx);
      if (result.kind === "err") {
        this.logger.warn("WorkflowTreeProvider: list failed", "WorkflowTreeProvider", result.error);
        const err = new WorkflowTreeItem(
          "",
          "Failed to load workflows",
          "root",
          vscode.TreeItemCollapsibleState.None,
          result.error.code
        );
        err.iconPath = new vscode.ThemeIcon("error");
        return [err];
      }
      const { workflows } = result.value as { workflows: WorkflowSummary[]; count: number };
      this.cachedWorkflows = workflows;
    }

    if (this.cachedWorkflows.length === 0) {
      const empty = new WorkflowTreeItem(
        "",
        "No workflows found",
        "root",
        vscode.TreeItemCollapsibleState.None
      );
      empty.iconPath = new vscode.ThemeIcon("info");
      return [empty];
    }

    // Build items fresh each time so running/last-run state is always current
    return this.cachedWorkflows.map((w) => {
      const isRunning = this.runningSet.has(w.name);
      const lastRun   = this.lastRuns.get(w.name);
      const hasSteps  = !isRunning && (lastRun?.stepResults.length ?? 0) > 0;

      const description = isRunning
        ? "running\u2026"
        : lastRun
          ? `${lastRun.success ? "\u2713" : "\u2717"} ${(lastRun.duration / 1000).toFixed(1)}s`
          : (w.description ?? `${w.stepCount} step(s)`);

      const it = new WorkflowTreeItem(
        w.name,
        w.name,
        "workflow",
        hasSteps ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        description
      );
      // "loading~spin" animates in TreeItem iconPath (unlike description which is plain text)
      it.iconPath = new vscode.ThemeIcon(isRunning ? "loading~spin" : "play");
      it.command = {
        command: "meridian.workflow.run",
        title: "Run Workflow",
        arguments: [{ name: w.name }],
      };
      return it;
    });
  }
}
