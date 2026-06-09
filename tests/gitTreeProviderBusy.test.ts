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
}));

import { GitTreeProvider } from "../src/ui/tree-providers/git-tree-provider";
import type { GitStatus, GitProvider, Logger } from "../src/types";

function makeProvider(status: () => Promise<{ kind: "ok"; value: GitStatus } | { kind: "err"; error: { code: string; message: string } }>): GitTreeProvider {
  const gitProvider = {
    status,
    getAllChanges: vi.fn(),
    getUntrackedFiles: vi.fn(),
    getRecentCommits: vi.fn(),
  } as unknown as GitProvider;
  const logger: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return new GitTreeProvider(gitProvider, logger, "/ws");
}

const okStatus = (branch: string): { kind: "ok"; value: GitStatus } => ({
  kind: "ok",
  value: { branch, isDirty: false, staged: 0, unstaged: 0, untracked: 0 } as GitStatus,
});

describe("GitTreeProvider busy state", () => {
  it("renders Refreshing… placeholder between refresh() and prefetch settle", async () => {
    let resolve!: (v: ReturnType<typeof okStatus>) => void;
    const pending = new Promise<ReturnType<typeof okStatus>>(r => { resolve = r; });
    const provider = makeProvider(() => pending);

    provider.refresh();
    const during = await provider.getChildren();
    expect(during.length).toBe(1);
    expect(during[0]!.label).toBe("Refreshing…");
    expect((during[0]!.iconPath as { id: string }).id).toBe("loading~spin");

    resolve(okStatus("main"));
    await pending;
    await Promise.resolve();
    await Promise.resolve();

    const after = await provider.getChildren();
    expect(after.length).toBe(1);
    expect(after[0]!.label).toBe("main");
  });

  it("generation token drops stale results from a superseded refresh", async () => {
    let resolveA!: (v: ReturnType<typeof okStatus>) => void;
    let resolveB!: (v: ReturnType<typeof okStatus>) => void;
    const first = new Promise<ReturnType<typeof okStatus>>(r => { resolveA = r; });
    const second = new Promise<ReturnType<typeof okStatus>>(r => { resolveB = r; });
    const calls: Array<Promise<ReturnType<typeof okStatus>>> = [first, second];
    const provider = makeProvider(() => calls.shift()!);

    provider.refresh();        // generation 1
    provider.refresh();        // generation 2 — supersedes
    resolveA(okStatus("stale"));  // resolves first, should be dropped
    resolveB(okStatus("fresh"));  // resolves second, commits
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const after = await provider.getChildren();
    expect(after[0]!.label).toBe("fresh");
  });

  it("initial mount uses inline fetch (no placeholder)", async () => {
    const provider = makeProvider(() => Promise.resolve(okStatus("init")));
    const items = await provider.getChildren();
    expect(items[0]!.label).toBe("init");
  });

  it("clears busy state even when the underlying status() rejects", async () => {
    let firstCall = true;
    const provider = makeProvider(() => {
      if (firstCall) { firstCall = false; return Promise.reject(new Error("boom")); }
      return Promise.resolve(okStatus("recovered"));
    });
    provider.refresh();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    const items = await provider.getChildren();
    expect(items.some(i => i.label === "Refreshing…")).toBe(false);
  });
});
