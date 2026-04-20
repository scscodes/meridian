import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { FileRunLog } from "../src/infrastructure/run-log";
import { MockLogger } from "./fixtures";
import {
  RUN_EVENT_SCHEMA_VERSION,
  RunEventV1,
  isSupportedRunEventVersion,
} from "../src/types";

function makeEvent(overrides: Partial<RunEventV1> = {}): RunEventV1 {
  return {
    schemaVersion: RUN_EVENT_SCHEMA_VERSION,
    eventId: `evt-${Math.random().toString(36).slice(2, 10)}`,
    runId: "run-1",
    timestampMs: Date.now(),
    source: "router",
    phase: "start",
    commandName: "git.status",
    ...overrides,
  };
}

async function withTempWorkspace(
  fn: (workspaceRoot: string) => Promise<void>
): Promise<void> {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "meridian-runlog-")
  );
  try {
    await fn(workspaceRoot);
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

describe("run-log", () => {
  it("appends and reads events in insertion order", async () => {
    await withTempWorkspace(async (workspaceRoot) => {
      const log = new FileRunLog(workspaceRoot, new MockLogger());
      const one = makeEvent({ runId: "run-a", phase: "start" });
      const two = makeEvent({
        runId: "run-a",
        phase: "complete",
        resultKind: "ok",
        durationMs: 10,
      });
      const three = makeEvent({ runId: "run-b", phase: "start" });

      expect((await log.appendMany([one, two, three])).kind).toBe("ok");

      const latest = await log.readLatest(3);
      expect(latest.kind).toBe("ok");
      if (latest.kind === "ok") {
        expect(latest.value.map((event) => event.runId)).toEqual([
          "run-a",
          "run-a",
          "run-b",
        ]);
      }
    });
  });

  it("filters by runId", async () => {
    await withTempWorkspace(async (workspaceRoot) => {
      const log = new FileRunLog(workspaceRoot, new MockLogger());
      await log.appendMany([
        makeEvent({ runId: "run-a", phase: "start" }),
        makeEvent({
          runId: "run-a",
          phase: "complete",
          resultKind: "ok",
        }),
        makeEvent({ runId: "run-b", phase: "start" }),
      ]);

      const result = await log.readByRunId("run-a");
      expect(result.kind).toBe("ok");
      if (result.kind === "ok") {
        expect(result.value).toHaveLength(2);
        expect(result.value.every((event) => event.runId === "run-a")).toBe(
          true
        );
      }
    });
  });

  it("returns parse error on malformed jsonl content", async () => {
    await withTempWorkspace(async (workspaceRoot) => {
      const log = new FileRunLog(workspaceRoot, new MockLogger());
      const filePath = path.join(
        workspaceRoot,
        ".vscode/meridian/run-log.v1.jsonl"
      );
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, "{bad json}\n", "utf8");

      const result = await log.readLatest(1);
      expect(result.kind).toBe("err");
      if (result.kind === "err") {
        expect(result.error.code).toBe("RUN_LOG_PARSE_ERROR");
      }
    });
  });

  it("rejects unsupported schema versions", async () => {
    await withTempWorkspace(async (workspaceRoot) => {
      const log = new FileRunLog(workspaceRoot, new MockLogger());
      const unsupported = {
        ...makeEvent(),
        schemaVersion: 2,
      } as unknown as RunEventV1;
      const result = await log.append(unsupported);
      expect(result.kind).toBe("err");
      if (result.kind === "err") {
        expect(result.error.code).toBe("RUN_LOG_VERSION_UNSUPPORTED");
      }
      expect(isSupportedRunEventVersion(2)).toBe(false);
      expect(isSupportedRunEventVersion(1)).toBe(true);
    });
  });
});

