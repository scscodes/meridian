/**
 * Reports-tree freshness — coarse relative-age descriptions read off the
 * `.meridian/latest/` snapshot mtimes (mtime-only ADR 020 consumer), plus the
 * onLatestSnapshotWrite hook that drives the redraw.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

vi.mock("vscode", () => ({
  TreeItem: class {
    description?: string;
    constructor(public label: string, public collapsibleState?: number) {}
  },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  ThemeIcon: class { constructor(public id: string) {} },
  EventEmitter: class {
    private listeners: Array<(arg: unknown) => void> = [];
    event = (cb: (arg: unknown) => void) => { this.listeners.push(cb); return { dispose: () => {} }; };
    fire = (arg?: unknown) => { for (const l of this.listeners) l(arg); };
  },
  Uri: { file: (p: string) => ({ fsPath: p }) },
}));

import {
  ReportsTreeProvider,
  formatRelativeAge,
} from "../src/ui/tree-providers/reports-tree-provider";
import {
  writeLatestSnapshot,
  onLatestSnapshotWrite,
  LatestSnapshotKind,
} from "../src/infrastructure/latest-snapshot";
import { LATEST_SNAPSHOT_FILES, MERIDIAN_DIR, MERIDIAN_LATEST_DIR } from "../src/constants";
import { MockLogger } from "./fixtures";

describe("formatRelativeAge", () => {
  it("buckets ages coarsely: just now / minutes / hours / days", () => {
    expect(formatRelativeAge(0)).toBe("just now");
    expect(formatRelativeAge(59_000)).toBe("just now");
    expect(formatRelativeAge(60_000)).toBe("1m ago");
    expect(formatRelativeAge(5 * 60_000)).toBe("5m ago");
    expect(formatRelativeAge(59 * 60_000)).toBe("59m ago");
    expect(formatRelativeAge(60 * 60_000)).toBe("1h ago");
    expect(formatRelativeAge(23 * 3_600_000)).toBe("23h ago");
    expect(formatRelativeAge(24 * 3_600_000)).toBe("1d ago");
    expect(formatRelativeAge(3 * 24 * 3_600_000)).toBe("3d ago");
  });
});

describe("ReportsTreeProvider freshness descriptions", () => {
  let root: string;
  let latestDir: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-reports-tree-"));
    latestDir = path.join(root, MERIDIAN_DIR, MERIDIAN_LATEST_DIR);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("renders three rows without descriptions when no workspace root is given", async () => {
    const provider = new ReportsTreeProvider(undefined);
    const items = await provider.getChildren();
    expect(items).toHaveLength(3);
    for (const item of items) expect(item.description).toBeUndefined();
  });

  it("renders without descriptions when no snapshots exist yet", async () => {
    const provider = new ReportsTreeProvider(root);
    const items = await provider.getChildren();
    expect(items).toHaveLength(3);
    for (const item of items) expect(item.description).toBeUndefined();
  });

  it("describes each row from its real snapshot mtime (hygiene → hygieneAnalytics)", async () => {
    const logger = new MockLogger();
    await writeLatestSnapshot(root, "sessionBriefing", {}, logger);
    await writeLatestSnapshot(root, "hygieneAnalytics", {}, logger);
    // Age the hygiene snapshot by 5 minutes; leave the briefing fresh.
    const hygieneFile = path.join(latestDir, LATEST_SNAPSHOT_FILES.hygieneAnalytics);
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
    fs.utimesSync(hygieneFile, fiveMinAgo, fiveMinAgo);

    const provider = new ReportsTreeProvider(root);
    const items = await provider.getChildren();
    const byId = new Map(items.map((i) => [i.reportId, i]));

    expect(byId.get("sessionBriefing")!.description).toBe("just now");
    expect(byId.get("hygiene")!.description).toBe("5m ago");
    // gitAnalytics snapshot was never written — description stays absent.
    expect(byId.get("gitAnalytics")!.description).toBeUndefined();
  });

  it("refresh() fires onDidChangeTreeData", () => {
    const provider = new ReportsTreeProvider(root);
    const seen: unknown[] = [];
    provider.onDidChangeTreeData((e: unknown) => seen.push(e));
    provider.refresh();
    expect(seen).toHaveLength(1);
  });
});

describe("onLatestSnapshotWrite", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-latest-hook-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("notifies subscribers with the written kind after a successful write", async () => {
    const kinds: LatestSnapshotKind[] = [];
    const unsubscribe = onLatestSnapshotWrite((kind) => kinds.push(kind));
    try {
      await writeLatestSnapshot(root, "gitAnalytics", {}, new MockLogger());
      expect(kinds).toEqual(["gitAnalytics"]);
    } finally {
      unsubscribe();
    }
  });

  it("does not notify on a failed write, and unsubscribe stops notifications", async () => {
    const logger = new MockLogger();
    const kinds: LatestSnapshotKind[] = [];
    const unsubscribe = onLatestSnapshotWrite((kind) => kinds.push(kind));

    // A file squatting as the "root" makes the write fail (ENOTDIR).
    const blockerFile = path.join(root, "not-a-dir");
    fs.writeFileSync(blockerFile, "x");
    await writeLatestSnapshot(blockerFile, "gitAnalytics", {}, logger);
    expect(kinds).toEqual([]);

    unsubscribe();
    await writeLatestSnapshot(root, "gitAnalytics", {}, logger);
    expect(kinds).toEqual([]);
  });

  it("a throwing listener is swallowed and later listeners still run", async () => {
    const kinds: LatestSnapshotKind[] = [];
    const unsubBad = onLatestSnapshotWrite(() => {
      throw new Error("bad listener");
    });
    const unsubGood = onLatestSnapshotWrite((kind) => kinds.push(kind));
    try {
      await expect(
        writeLatestSnapshot(root, "sessionBriefing", {}, new MockLogger())
      ).resolves.toBeUndefined();
      expect(kinds).toEqual(["sessionBriefing"]);
    } finally {
      unsubBad();
      unsubGood();
    }
  });
});
