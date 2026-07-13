/**
 * Headless snapshot refresh tests (ADR 020 addendum) — the core
 * refreshLatestSnapshots orchestration: dispatch order, snapshot writes per
 * successful report, and per-report failure isolation. The vscode command
 * wrapper is thin wiring and is exercised only for module resolution.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

vi.mock("vscode", () => ({}));

import { refreshLatestSnapshots } from "../src/presentation/latest-refresh";
import { LATEST_SNAPSHOT_FILES, MERIDIAN_DIR, MERIDIAN_LATEST_DIR } from "../src/constants";
import { Command, CommandContext, Result, success, failure } from "../src/types";
import { PruneConfig } from "../src/domains/hygiene/analytics-types";
import { MockLogger, createMockContext } from "./fixtures";

const PRUNE_CONFIG: PruneConfig = {
  minAgeDays: 30,
  maxSizeMB: 1,
  minLineCount: 0,
  categories: ["backup", "temp", "log", "artifact"],
};

describe("refreshLatestSnapshots", () => {
  let root: string;
  let ctx: CommandContext;
  let logger: MockLogger;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-refresh-"));
    ctx = createMockContext();
    logger = new MockLogger();
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function readSnapshot(file: string): Record<string, unknown> {
    return JSON.parse(
      fs.readFileSync(path.join(root, MERIDIAN_DIR, MERIDIAN_LATEST_DIR, file), "utf-8")
    );
  }

  it("dispatches all three report commands and writes all three snapshots", async () => {
    const dispatched: Command[] = [];
    const dispatch = async (cmd: Command): Promise<Result<unknown>> => {
      dispatched.push(cmd);
      return success({ from: cmd.name });
    };

    const outcome = await refreshLatestSnapshots(root, dispatch, ctx, PRUNE_CONFIG, logger);

    expect(outcome.written).toEqual(["gitAnalytics", "hygieneAnalytics", "sessionBriefing"]);
    expect(outcome.failures).toEqual([]);

    // Analytics dispatched before the briefing so the briefing reuses the
    // just-warmed analyzer cache; hygiene receives the injected prune config.
    expect(dispatched.map((c) => c.name)).toEqual([
      "git.showAnalytics", "hygiene.showAnalytics", "git.sessionBriefing",
    ]);
    expect(dispatched[1]?.params).toEqual(PRUNE_CONFIG);

    expect(readSnapshot(LATEST_SNAPSHOT_FILES.gitAnalytics).report).toEqual({ from: "git.showAnalytics" });
    expect(readSnapshot(LATEST_SNAPSHOT_FILES.hygieneAnalytics).report).toEqual({ from: "hygiene.showAnalytics" });
    expect(readSnapshot(LATEST_SNAPSHOT_FILES.sessionBriefing).report).toEqual({ from: "git.sessionBriefing" });
  });

  it("one report's failure never blocks the others", async () => {
    const dispatch = async (cmd: Command): Promise<Result<unknown>> =>
      cmd.name === "hygiene.showAnalytics"
        ? failure({ code: "SCAN_FAILED", message: "no scan yet" })
        : success({ from: cmd.name });

    const outcome = await refreshLatestSnapshots(root, dispatch, ctx, PRUNE_CONFIG, logger);

    expect(outcome.written).toEqual(["gitAnalytics", "sessionBriefing"]);
    expect(outcome.failures).toEqual([{ kind: "hygieneAnalytics", message: "no scan yet" }]);

    const latestDir = path.join(root, MERIDIAN_DIR, MERIDIAN_LATEST_DIR);
    expect(fs.existsSync(path.join(latestDir, LATEST_SNAPSHOT_FILES.gitAnalytics))).toBe(true);
    expect(fs.existsSync(path.join(latestDir, LATEST_SNAPSHOT_FILES.hygieneAnalytics))).toBe(false);
    expect(fs.existsSync(path.join(latestDir, LATEST_SNAPSHOT_FILES.sessionBriefing))).toBe(true);
  });

  it("snapshots are on disk when the promise resolves (writes are awaited, not queued-and-forgotten)", async () => {
    const dispatch = async (cmd: Command): Promise<Result<unknown>> => success({ from: cmd.name });

    await refreshLatestSnapshots(root, dispatch, ctx, PRUNE_CONFIG, logger);

    const entries = fs.readdirSync(path.join(root, MERIDIAN_DIR, MERIDIAN_LATEST_DIR));
    expect(entries.filter((e) => e.endsWith(".tmp"))).toHaveLength(0);
    expect(entries).toEqual(
      expect.arrayContaining(Object.values(LATEST_SNAPSHOT_FILES))
    );
  });
});
