import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  TreeItem: class { constructor(public label: string, public collapsibleState?: number) {} },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  ThemeIcon: class { constructor(public id: string) {} },
  EventEmitter: class {
    private listeners: Array<(arg: unknown) => void> = [];
    event = (cb: (arg: unknown) => void) => { this.listeners.push(cb); return { dispose: () => {} }; };
    fire = (arg?: unknown) => { for (const l of this.listeners) l(arg); };
  },
  Uri: { file: (p: string) => ({ fsPath: p }) },
  Range: class { constructor() {} },
}));

import { HygieneTreeProvider } from "../src/ui/tree-providers/hygiene-tree-provider";
import type { CommandContext, Logger, WorkspaceScan } from "../src/types";

const emptyScan: WorkspaceScan = {
  deadCode: { items: [], tsconfigPath: null },
  deadFiles: [],
  largeFiles: [],
  logFiles: [],
  markdownFiles: [],
} as unknown as WorkspaceScan;

function makeProvider(dispatch: () => Promise<{ kind: "ok"; value: WorkspaceScan } | { kind: "err"; error: { code: string; message: string } }>): HygieneTreeProvider {
  const logger: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return new HygieneTreeProvider(dispatch as never, {} as CommandContext, logger);
}

describe("HygieneTreeProvider busy state", () => {
  it("renders Refreshing… placeholder between refresh() and prefetch settle", async () => {
    let resolve!: (v: { kind: "ok"; value: WorkspaceScan }) => void;
    const pending = new Promise<{ kind: "ok"; value: WorkspaceScan }>(r => { resolve = r; });
    const provider = makeProvider(() => pending);

    provider.refresh();
    const during = await provider.getChildren();
    expect(during.length).toBe(1);
    expect(during[0]!.label).toBe("Refreshing…");
    expect((during[0]!.iconPath as { id: string }).id).toBe("loading~spin");

    resolve({ kind: "ok", value: emptyScan });
    await pending;
    await Promise.resolve();
    await Promise.resolve();

    const after = await provider.getChildren();
    expect(after.some(i => i.label === "Refreshing…")).toBe(false);
  });

  it("generation token drops stale results from a superseded refresh", async () => {
    let resolveA!: (v: { kind: "ok"; value: WorkspaceScan }) => void;
    let resolveB!: (v: { kind: "ok"; value: WorkspaceScan }) => void;
    const first = new Promise<{ kind: "ok"; value: WorkspaceScan }>(r => { resolveA = r; });
    const second = new Promise<{ kind: "ok"; value: WorkspaceScan }>(r => { resolveB = r; });
    const calls = [first, second];
    const provider = makeProvider(() => calls.shift()!);

    const staleScan = { ...emptyScan, deadFiles: ["/a"] } as unknown as WorkspaceScan;
    const freshScan = { ...emptyScan, deadFiles: ["/b"] } as unknown as WorkspaceScan;

    provider.refresh();
    provider.refresh();
    resolveA({ kind: "ok", value: staleScan });
    resolveB({ kind: "ok", value: freshScan });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const after = await provider.getChildren();
    const deadCat = after.find(i => i.label === "Dead Files");
    expect(deadCat?.description).toBe("1");
  });
});
