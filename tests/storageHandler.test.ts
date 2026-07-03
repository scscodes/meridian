/**
 * Hygiene storage handler tests (ADR 019) — hygiene.storageStatus and
 * hygiene.pruneStorage over a real temp workspace.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { CommandContext } from "../src/types";
import { MockLogger, MockRunLog } from "./fixtures";
import type { StorageStatus } from "../src/infrastructure/retention";
import type { PruneStorageOutcome } from "../src/domains/hygiene/storage-handler";

// storage-handler → retention → settings → vscode; empty mock → typed defaults.
vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(),
    workspaceFolders: undefined,
  },
}));

import { createStorageHandlers } from "../src/domains/hygiene/storage-handler";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("hygiene storage handlers", () => {
  let root: string;
  let ctx: CommandContext;
  let logger: MockLogger;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-storage-"));
    ctx = { extensionPath: "", workspaceFolders: [root] };
    logger = new MockLogger();
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function writeArtifact(name: string, ageDays: number): void {
    const dir = path.join(root, ".meridian", "artifacts");
    fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, name);
    fs.writeFileSync(p, "x".repeat(10));
    const mtime = new Date(Date.now() - ageDays * DAY_MS);
    fs.utimesSync(p, mtime, mtime);
  }

  it("storageStatus reports an empty workspace cleanly", async () => {
    const { storageStatus } = createStorageHandlers(logger as never);
    const result = await storageStatus(ctx, {});
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const status = result.value as StorageStatus;
    expect(status.artifacts.fileCount).toBe(0);
    expect(status.artifacts.wouldPruneCount).toBe(0);
    expect(status.runLog.lineCount).toBe(0);
    expect(status.pulse.snapshotCount).toBe(0);
  });

  it("storageStatus fails when no workspace root is resolvable", async () => {
    const { storageStatus } = createStorageHandlers(logger as never);
    const result = await storageStatus({ extensionPath: "", workspaceFolders: [] }, {});
    expect(result.kind).toBe("err");
    if (result.kind === "err") expect(result.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("pruneStorage prunes stale artifacts and compacts the run log", async () => {
    writeArtifact("stale.json", 40);   // default maxAgeDays 30 → prune
    writeArtifact("fresh.json", 1);

    const runLog = new MockRunLog();
    // Over the default 5000-event cap.
    runLog.setEvents(
      Array.from({ length: 5010 }, (_, i) => ({
        schemaVersion: 1 as const,
        eventId: `e${i}`,
        runId: `r${i}`,
        timestampMs: i,
        source: "router" as const,
        phase: "start" as const,
        commandName: "git.status" as const,
      }))
    );

    const { pruneStorage } = createStorageHandlers(logger as never, runLog);
    const result = await pruneStorage(ctx, {});
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const outcome = result.value as PruneStorageOutcome;
    expect(outcome.artifacts.deletedCount).toBe(1);
    expect(outcome.runLogDropped).toBe(10);
    expect(fs.existsSync(path.join(root, ".meridian", "artifacts", "fresh.json"))).toBe(true);
    expect(fs.existsSync(path.join(root, ".meridian", "artifacts", "stale.json"))).toBe(false);
  });

  it("pruneStorage succeeds without a run log (artifacts-only)", async () => {
    writeArtifact("stale.json", 40);
    const { pruneStorage } = createStorageHandlers(logger as never);
    const result = await pruneStorage(ctx, {});
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect((result.value as PruneStorageOutcome).runLogDropped).toBe(0);
  });

  it("storageStatus is TTL-cached per root and invalidated by a successful prune", async () => {
    const { storageStatus, pruneStorage } = createStorageHandlers(logger as never);

    const first = await storageStatus(ctx, {});
    expect(first.kind).toBe("ok");
    if (first.kind !== "ok") return;
    expect((first.value as StorageStatus).artifacts.fileCount).toBe(0);

    // A new artifact inside the TTL window is invisible — cached value served.
    writeArtifact("stale.json", 40);
    const second = await storageStatus(ctx, {});
    if (second.kind !== "ok") return;
    expect((second.value as StorageStatus).artifacts.fileCount).toBe(0);

    // Prune invalidates: the post-prune status recomputes from disk.
    const pruned = await pruneStorage(ctx, {});
    expect(pruned.kind).toBe("ok");
    const third = await storageStatus(ctx, {});
    if (third.kind !== "ok") return;
    expect((third.value as StorageStatus).artifacts.fileCount).toBe(0); // stale.json pruned
    expect((third.value as StorageStatus).artifacts.wouldPruneCount).toBe(0);
  });
});
