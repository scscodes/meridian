/**
 * Latest-snapshot tests (ADR 020) — envelope shape, atomic overwrite,
 * self-ignore + AGENTS.md create-if-missing, and fail-soft on a bad root.
 * Pure Node module under test — no vscode mock needed.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  writeLatestSnapshot,
  LATEST_SNAPSHOT_SCHEMA_VERSION,
  LatestSnapshotKind,
} from "../src/infrastructure/latest-snapshot";
import { LATEST_SNAPSHOT_FILES, MERIDIAN_DIR, MERIDIAN_LATEST_DIR } from "../src/constants";
import { MockLogger } from "./fixtures";

describe("writeLatestSnapshot", () => {
  let root: string;
  let latestDir: string;
  let logger: MockLogger;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-latest-"));
    latestDir = path.join(root, MERIDIAN_DIR, MERIDIAN_LATEST_DIR);
    logger = new MockLogger();
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function readSnapshot(kind: LatestSnapshotKind): Record<string, unknown> {
    const target = path.join(latestDir, LATEST_SNAPSHOT_FILES[kind]);
    return JSON.parse(fs.readFileSync(target, "utf-8"));
  }

  it("writes the correct versioned filename per kind", async () => {
    for (const kind of Object.keys(LATEST_SNAPSHOT_FILES) as LatestSnapshotKind[]) {
      await writeLatestSnapshot(root, kind, { ok: true }, logger);
      expect(fs.existsSync(path.join(latestDir, LATEST_SNAPSHOT_FILES[kind]))).toBe(true);
    }
    expect(LATEST_SNAPSHOT_FILES.sessionBriefing).toBe("session-briefing.v1.json");
    expect(LATEST_SNAPSHOT_FILES.gitAnalytics).toBe("git-analytics.v1.json");
    expect(LATEST_SNAPSHOT_FILES.hygieneAnalytics).toBe("hygiene-analytics.v1.json");
  });

  it("pins all three envelope `kind` wire values (ADR 020: keys are wire-frozen)", async () => {
    // The LATEST_SNAPSHOT_FILES keys are written verbatim as the public
    // envelope `kind`. An internal rename of a key is a silent breaking
    // change to the v1 contract — this test is what makes it loud.
    for (const kind of ["sessionBriefing", "gitAnalytics", "hygieneAnalytics"] as const) {
      await writeLatestSnapshot(root, kind, {}, logger);
      expect(readSnapshot(kind).kind).toBe(kind);
    }
  });

  it("writes a parseable envelope with schemaVersion, kind, generatedAt, and report", async () => {
    await writeLatestSnapshot(root, "gitAnalytics", { summary: { totalCommits: 3 } }, logger);
    const parsed = readSnapshot("gitAnalytics");

    expect(parsed.schemaVersion).toBe(LATEST_SNAPSHOT_SCHEMA_VERSION);
    expect(parsed.kind).toBe("gitAnalytics");
    expect(typeof parsed.generatedAt).toBe("string");
    expect(new Date(parsed.generatedAt as string).toISOString()).toBe(parsed.generatedAt);
    expect(parsed.report).toEqual({ summary: { totalCommits: 3 } });
  });

  it("serializes Date fields in the report to ISO strings", async () => {
    const generatedAt = new Date("2026-01-15T12:00:00.000Z");
    await writeLatestSnapshot(root, "sessionBriefing", { generatedAt, branch: "main" }, logger);
    const parsed = readSnapshot("sessionBriefing");

    expect((parsed.report as Record<string, unknown>).generatedAt).toBe("2026-01-15T12:00:00.000Z");
  });

  it("second write overwrites in place — no accumulation, no .tmp residue", async () => {
    await writeLatestSnapshot(root, "hygieneAnalytics", { version: 1 }, logger);
    await writeLatestSnapshot(root, "hygieneAnalytics", { version: 2 }, logger);

    const parsed = readSnapshot("hygieneAnalytics");
    expect(parsed.report).toEqual({ version: 2 });

    const entries = fs.readdirSync(latestDir);
    expect(entries.filter((e) => e.endsWith(".tmp"))).toHaveLength(0);
    expect(entries.filter((e) => e === LATEST_SNAPSHOT_FILES.hygieneAnalytics)).toHaveLength(1);
  });

  it("creates .gitignore once and never clobbers an existing modified one", async () => {
    await writeLatestSnapshot(root, "gitAnalytics", {}, logger);
    const gitignore = path.join(latestDir, ".gitignore");
    expect(fs.readFileSync(gitignore, "utf-8")).toBe("*\n");

    fs.writeFileSync(gitignore, "# custom\n", "utf-8");
    await writeLatestSnapshot(root, "gitAnalytics", {}, logger);

    expect(fs.readFileSync(gitignore, "utf-8")).toBe("# custom\n");
  });

  it("creates AGENTS.md once and never clobbers an existing edited one", async () => {
    await writeLatestSnapshot(root, "sessionBriefing", {}, logger);
    const agentsMd = path.join(root, MERIDIAN_DIR, "AGENTS.md");
    expect(fs.existsSync(agentsMd)).toBe(true);
    expect(fs.readFileSync(agentsMd, "utf-8")).toContain(".meridian/latest/");

    fs.writeFileSync(agentsMd, "# my custom notes\n", "utf-8");
    await writeLatestSnapshot(root, "sessionBriefing", {}, logger);

    expect(fs.readFileSync(agentsMd, "utf-8")).toBe("# my custom notes\n");
  });

  it("a broken side file never blocks the snapshot write itself", async () => {
    // A directory squatting at .meridian/AGENTS.md makes the side-file write
    // fail persistently (surfaces as EEXIST, swallowed as "already present"
    // per the never-clobber contract); the snapshot must still land — side
    // files live in an isolated error scope.
    const squatter = path.join(root, MERIDIAN_DIR, "AGENTS.md");
    fs.mkdirSync(squatter, { recursive: true });

    await writeLatestSnapshot(root, "sessionBriefing", { branch: "main" }, logger);

    expect(readSnapshot("sessionBriefing").report).toEqual({ branch: "main" });
    expect(fs.statSync(squatter).isDirectory()).toBe(true);
  });

  it("serializes concurrent writes through the queue — last call wins, output intact", async () => {
    // Fire without awaiting individually: the module-level queue must
    // prevent tmp+rename interleaving and preserve FIFO (last-write-wins).
    const writes = Array.from({ length: 10 }, (_, i) =>
      writeLatestSnapshot(root, "gitAnalytics", { version: i }, logger)
    );
    await Promise.all(writes);

    const parsed = readSnapshot("gitAnalytics");
    expect(parsed.report).toEqual({ version: 9 });
    expect(fs.readdirSync(latestDir).filter((e) => e.includes(".tmp"))).toHaveLength(0);
  });

  it("an invalid workspaceRoot resolves without throwing and warns via the logger", async () => {
    // A file (not a dir) as the "root" makes mkdirSync recursive fail with ENOTDIR.
    const blockerFile = path.join(root, "not-a-dir");
    fs.writeFileSync(blockerFile, "x");

    await expect(
      writeLatestSnapshot(blockerFile, "gitAnalytics", {}, logger)
    ).resolves.toBeUndefined();

    expect(logger.getByLevel("warn").length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(blockerFile, MERIDIAN_LATEST_DIR))).toBe(false);
  });
});
