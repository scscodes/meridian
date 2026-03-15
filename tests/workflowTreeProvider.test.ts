/**
 * WorkflowTreeProvider Tests — covers step expansion after run, stale-data
 * clearing on re-run, and collapsible state transitions (ADR 007).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CommandContext } from "../src/types";
import { success } from "../src/types";
import { MockLogger } from "./fixtures";

vi.mock("vscode", () => {
  class TreeItem {
    label: string;
    collapsibleState: number;
    description?: string;
    iconPath?: unknown;
    command?: unknown;
    contextValue?: string;
    constructor(label: string, collapsibleState: number) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  }
  return {
    TreeItem,
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    ThemeIcon: class { constructor(public id: string) {} },
    EventEmitter: class {
      event = vi.fn();
      fire = vi.fn();
      dispose = vi.fn();
    },
  };
});

import { WorkflowTreeProvider } from "../src/ui/tree-providers/workflow-tree-provider";
import * as vscode from "vscode";

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_CTX: CommandContext = {
  extensionPath: "/ext",
  workspaceFolders: ["/ws"],
};

const WORKFLOW_LIST_RESULT = success({
  workflows: [
    { name: "deploy", description: "Deploy pipeline", stepCount: 3 },
    { name: "ci", description: "CI checks", stepCount: 2 },
  ],
  count: 2,
});

function makeProvider() {
  const dispatch = vi.fn().mockResolvedValue(WORKFLOW_LIST_RESULT);
  const logger = new MockLogger();
  const provider = new WorkflowTreeProvider(dispatch as any, BASE_CTX, logger);
  return { provider, dispatch };
}

async function getWorkflowItem(provider: WorkflowTreeProvider, name: string) {
  const roots = await provider.getChildren();
  return roots.find((item: any) => item.workflowName === name) as any;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("WorkflowTreeProvider — before any run", () => {
  it("root items have collapsibleState None and no children", async () => {
    const { provider } = makeProvider();
    const deployItem = await getWorkflowItem(provider, "deploy");
    expect(deployItem).toBeDefined();
    expect(deployItem.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
    const children = await provider.getChildren(deployItem);
    expect(children).toHaveLength(0);
  });

  it("workflow item uses workflowName property (not label cast)", async () => {
    const { provider } = makeProvider();
    const deployItem = await getWorkflowItem(provider, "deploy");
    expect(deployItem.workflowName).toBe("deploy");
  });
});

describe("WorkflowTreeProvider — after setLastRun with step results", () => {
  const stepResults = [
    { stepId: "build", success: true },
    { stepId: "test", success: false, error: "timeout" },
    { stepId: "deploy", success: true },
  ];

  it("workflow item becomes Collapsed", async () => {
    const { provider } = makeProvider();
    provider.setLastRun("deploy", false, 1200, stepResults);
    const deployItem = await getWorkflowItem(provider, "deploy");
    expect(deployItem.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
  });

  it("getChildren returns one item per step in order", async () => {
    const { provider } = makeProvider();
    provider.setLastRun("deploy", false, 1200, stepResults);
    const deployItem = await getWorkflowItem(provider, "deploy");
    const children = await provider.getChildren(deployItem);
    expect(children).toHaveLength(3);
    expect((children[0] as any).label).toBe("build");
    expect((children[1] as any).label).toBe("test");
    expect((children[2] as any).label).toBe("deploy");
  });

  it("successful step gets pass icon", async () => {
    const { provider } = makeProvider();
    provider.setLastRun("deploy", false, 1200, stepResults);
    const deployItem = await getWorkflowItem(provider, "deploy");
    const children = await provider.getChildren(deployItem);
    expect((children[0] as any).iconPath?.id).toBe("pass");
  });

  it("failed step gets error icon and error in description", async () => {
    const { provider } = makeProvider();
    provider.setLastRun("deploy", false, 1200, stepResults);
    const deployItem = await getWorkflowItem(provider, "deploy");
    const children = await provider.getChildren(deployItem);
    expect((children[1] as any).iconPath?.id).toBe("error");
    expect((children[1] as any).description).toBe("timeout");
  });

  it("unrelated workflow item stays None (no cross-contamination)", async () => {
    const { provider } = makeProvider();
    provider.setLastRun("deploy", false, 1200, stepResults);
    const ciItem = await getWorkflowItem(provider, "ci");
    expect(ciItem.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
    const children = await provider.getChildren(ciItem);
    expect(children).toHaveLength(0);
  });
});

describe("WorkflowTreeProvider — re-run intermediate state", () => {
  const stepResults = [
    { stepId: "build", success: true },
    { stepId: "test", success: true },
  ];

  it("setRunning clears stepResults so stale children are not shown during re-run", async () => {
    const { provider } = makeProvider();
    // First run completes with step data
    provider.setLastRun("deploy", true, 1000, stepResults);
    const itemAfterRun = await getWorkflowItem(provider, "deploy");
    const childrenAfterRun = await provider.getChildren(itemAfterRun);
    expect(childrenAfterRun).toHaveLength(2);

    // Re-run starts — stale data cleared
    provider.setRunning("deploy");
    const itemDuringRun = await getWorkflowItem(provider, "deploy");
    const childrenDuringRun = await provider.getChildren(itemDuringRun);
    expect(childrenDuringRun).toHaveLength(0);
  });

  it("setRunning shows running description and spinning icon", async () => {
    const { provider } = makeProvider();
    provider.setRunning("deploy");
    const deployItem = await getWorkflowItem(provider, "deploy");
    expect(deployItem.description).toContain("running");
    expect((deployItem.iconPath as any)?.id).toBe("loading~spin");
  });

  it("item reverts to None collapsibleState while running (no steps yet)", async () => {
    const { provider } = makeProvider();
    provider.setLastRun("deploy", true, 1000, stepResults);
    provider.setRunning("deploy");
    const deployItem = await getWorkflowItem(provider, "deploy");
    expect(deployItem.collapsibleState).toBe(vscode.TreeItemCollapsibleState.None);
  });

  it("setLastRun after re-run shows new step data", async () => {
    const { provider } = makeProvider();
    provider.setLastRun("deploy", true, 1000, stepResults);
    provider.setRunning("deploy");

    const newSteps = [
      { stepId: "build", success: true },
      { stepId: "test", success: false, error: "assertion failed" },
    ];
    provider.setLastRun("deploy", false, 1500, newSteps);

    const deployItem = await getWorkflowItem(provider, "deploy");
    const children = await provider.getChildren(deployItem);
    expect(children).toHaveLength(2);
    expect((children[1] as any).description).toBe("assertion failed");
  });
});

describe("WorkflowTreeProvider — step items have correct contextValue", () => {
  it("step items have contextValue workflowStep", async () => {
    const { provider } = makeProvider();
    provider.setLastRun("deploy", true, 500, [{ stepId: "build", success: true }]);
    const deployItem = await getWorkflowItem(provider, "deploy");
    const children = await provider.getChildren(deployItem);
    expect((children[0] as any).contextValue).toBe("workflowStep");
  });
});
