/**
 * Retention engine tests (ADR 019) — pure prune planning, artifact pruning
 * against a real temp dir, and storage status (including the shared-plan
 * guarantee that the preview equals the prune).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// retention → settings → vscode; an empty workspace mock makes readSetting
// fall through to SETTING_DEFAULTS (50 files / 30 days / 5000 events).
vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(),
    workspaceFolders: undefined,
  },
}));
import {
  ArtifactFileInfo,
  computeStorageStatus,
  listArtifacts,
  planArtifactPrune,
  pruneArtifacts,
} from "../src/infrastructure/retention";
import { MockLogger } from "./fixtures";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

function file(name: string, ageDays: number, sizeBytes = 100): ArtifactFileInfo {
  return { name, mtimeMs: NOW - ageDays * DAY_MS, sizeBytes };
}

describe("planArtifactPrune (pure)", () => {
  it("keeps everything when both rules are disabled (0)", () => {
    const files = [file("a.json", 400), file("b.csv", 1)];
    const { keep, prune } = planArtifactPrune(files, { artifactsMaxCount: 0, artifactsMaxAgeDays: 0 }, NOW);
    expect(keep).toHaveLength(2);
    expect(prune).toHaveLength(0);
  });

  it("prunes files older than maxAgeDays regardless of count", () => {
    const files = [file("old.json", 31), file("fresh.json", 29)];
    const { prune } = planArtifactPrune(files, { artifactsMaxCount: 0, artifactsMaxAgeDays: 30 }, NOW);
    expect(prune.map((f) => f.name)).toEqual(["old.json"]);
  });

  it("count cap keeps the newest N; oldest overflow prunes first", () => {
    const files = [file("d1.json", 1), file("d3.json", 3), file("d2.json", 2), file("d4.json", 4)];
    const { keep, prune } = planArtifactPrune(files, { artifactsMaxCount: 2, artifactsMaxAgeDays: 0 }, NOW);
    expect(keep.map((f) => f.name)).toEqual(["d1.json", "d2.json"]);
    expect(prune.map((f) => f.name).sort()).toEqual(["d3.json", "d4.json"]);
  });

  it("age and count rules compose (age victims don't consume count slots)", () => {
    const files = [file("ancient.json", 90), file("d1.json", 1), file("d2.json", 2)];
    const { keep, prune } = planArtifactPrune(files, { artifactsMaxCount: 2, artifactsMaxAgeDays: 30 }, NOW);
    expect(keep.map((f) => f.name)).toEqual(["d1.json", "d2.json"]);
    expect(prune.map((f) => f.name)).toEqual(["ancient.json"]);
  });
});

describe("pruneArtifacts / listArtifacts / computeStorageStatus (fs)", () => {
  let root: string;
  let artifactsDir: string;
  let logger: MockLogger;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-retention-"));
    artifactsDir = path.join(root, ".meridian", "artifacts");
    fs.mkdirSync(artifactsDir, { recursive: true });
    fs.writeFileSync(path.join(artifactsDir, ".gitignore"), "*\n");
    logger = new MockLogger();
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function writeArtifact(name: string, ageDays: number, content = "x".repeat(50)): void {
    const p = path.join(artifactsDir, name);
    fs.writeFileSync(p, content);
    const mtime = new Date(Date.now() - ageDays * DAY_MS);
    fs.utimesSync(p, mtime, mtime);
  }

  it("listArtifacts excludes the self-ignore .gitignore and returns [] for a missing dir", async () => {
    writeArtifact("report.json", 1);
    const files = await listArtifacts(root);
    expect(files.map((f) => f.name)).toEqual(["report.json"]);

    const empty = await listArtifacts(path.join(root, "nowhere"));
    expect(empty).toEqual([]);
  });

  it("prunes by count, keeping the newest and never touching .gitignore", async () => {
    writeArtifact("oldest.json", 5);
    writeArtifact("middle.json", 3);
    writeArtifact("newest.json", 1);

    const result = await pruneArtifacts(root, { artifactsMaxCount: 1, artifactsMaxAgeDays: 0 }, logger as never);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.value.deletedCount).toBe(2);
      expect(result.value.freedBytes).toBe(100);
    }
    expect(fs.readdirSync(artifactsDir).sort()).toEqual([".gitignore", "newest.json"]);
  });

  it("prunes by age", async () => {
    writeArtifact("stale.json", 40);
    writeArtifact("fresh.json", 1);

    const result = await pruneArtifacts(root, { artifactsMaxCount: 0, artifactsMaxAgeDays: 30 }, logger as never);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect(result.value.deletedCount).toBe(1);
    expect(fs.existsSync(path.join(artifactsDir, "stale.json"))).toBe(false);
    expect(fs.existsSync(path.join(artifactsDir, "fresh.json"))).toBe(true);
  });

  it("storage status reports footprint and a would-prune preview matching the actual prune", async () => {
    writeArtifact("a.json", 40);
    writeArtifact("b.json", 1);
    fs.mkdirSync(path.join(root, ".vscode", "meridian"), { recursive: true });
    fs.writeFileSync(path.join(root, ".vscode", "meridian", "run-log.v1.jsonl"), '{"e":1}\n{"e":2}\n');

    const status = await computeStorageStatus(root);
    expect(status.kind).toBe("ok");
    if (status.kind !== "ok") return;

    expect(status.value.artifacts.fileCount).toBe(2);
    expect(status.value.artifacts.totalBytes).toBe(100);
    expect(status.value.runLog.lineCount).toBe(2);
    // Default policy (30d/50 files): a.json (40d) is the only would-prune victim.
    expect(status.value.artifacts.wouldPruneCount).toBe(1);
    expect(status.value.artifacts.wouldPruneBytes).toBe(50);

    const pruned = await pruneArtifacts(
      root,
      { artifactsMaxCount: status.value.policy.artifactsMaxCount, artifactsMaxAgeDays: status.value.policy.artifactsMaxAgeDays },
      logger as never
    );
    if (pruned.kind === "ok") {
      expect(pruned.value.deletedCount).toBe(status.value.artifacts.wouldPruneCount);
      expect(pruned.value.freedBytes).toBe(status.value.artifacts.wouldPruneBytes);
    }
  });
});
