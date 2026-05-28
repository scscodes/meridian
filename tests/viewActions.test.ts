import { beforeEach, describe, expect, it, vi } from "vitest";

const { showQuickPickMock, executeCommandMock } = vi.hoisted(() => ({
  showQuickPickMock: vi.fn(),
  executeCommandMock: vi.fn(),
}));

vi.mock("vscode", () => ({
  window: { showQuickPick: showQuickPickMock },
  commands: { executeCommand: executeCommandMock, registerCommand: vi.fn() },
  TreeItem: class { constructor(public label: string, public collapsibleState?: number) {} },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  ThemeIcon: class { constructor(public id: string) {} },
  EventEmitter: class { event = vi.fn(); fire = vi.fn(); },
  Uri: { file: (p: string) => ({ fsPath: p }) },
  Range: class { constructor() {} },
}));

import { showActionsQuickPick } from "../src/presentation/tree-setup";

describe("showActionsQuickPick", () => {
  beforeEach(() => {
    showQuickPickMock.mockReset();
    executeCommandMock.mockReset();
  });

  it("git view offers Refresh + Open Settings", async () => {
    showQuickPickMock.mockResolvedValue(undefined);
    await showActionsQuickPick("git");
    const items = showQuickPickMock.mock.calls[0]![0] as { command: string }[];
    expect(items.map(i => i.command)).toEqual([
      "meridian.git.refresh",
      "meridian.openSettings",
    ]);
  });

  it("hygiene view offers Refresh + Open Settings", async () => {
    showQuickPickMock.mockResolvedValue(undefined);
    await showActionsQuickPick("hygiene");
    const items = showQuickPickMock.mock.calls[0]![0] as { command: string }[];
    expect(items.map(i => i.command)).toEqual([
      "meridian.hygiene.refresh",
      "meridian.openSettings",
    ]);
  });

  it("reports view offers only Open Settings", async () => {
    showQuickPickMock.mockResolvedValue(undefined);
    await showActionsQuickPick("reports");
    const items = showQuickPickMock.mock.calls[0]![0] as { command: string }[];
    expect(items.map(i => i.command)).toEqual(["meridian.openSettings"]);
  });

  it("selecting an item executes its underlying command", async () => {
    showQuickPickMock.mockResolvedValue({
      label: "$(refresh) Refresh Git View",
      command: "meridian.git.refresh",
    });
    await showActionsQuickPick("git");
    expect(executeCommandMock).toHaveBeenCalledWith("meridian.git.refresh");
  });

  it("dismissing the quick-pick is a no-op", async () => {
    showQuickPickMock.mockResolvedValue(undefined);
    await showActionsQuickPick("git");
    expect(executeCommandMock).not.toHaveBeenCalled();
  });
});
