/**
 * Pulse store tests (ADR 019) — versioned JSONL append/read, self-ignore,
 * cap compaction, and tolerant reads.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { FilePulseStore, PulseSnapshotV1, PULSE_SCHEMA_VERSION } from "../src/infrastructure/pulse-store";
import { PULSE } from "../src/constants";
import { MockLogger } from "./fixtures";

function snapshot(overrides: Partial<PulseSnapshotV1> = {}): PulseSnapshotV1 {
  return {
    schemaVersion: PULSE_SCHEMA_VERSION,
    timestampMs: Date.now(),
    branch: "main",
    uncommittedCount: 2,
    ...overrides,
  };
}

describe("FilePulseStore", () => {
  let root: string;
  let store: FilePulseStore;
  let logger: MockLogger;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-pulse-"));
    logger = new MockLogger();
    store = new FilePulseStore(root, logger as never);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const pulseFile = () => path.join(root, ".meridian", "pulse", `pulse.v${PULSE_SCHEMA_VERSION}.jsonl`);

  it("append materializes the dir with a self-ignoring .gitignore and persists the snapshot", async () => {
    const result = await store.append(snapshot({ deadFileCount: 3 }));
    expect(result.kind).toBe("ok");

    expect(fs.readFileSync(path.join(root, ".meridian", "pulse", ".gitignore"), "utf8")).toBe("*\n");
    const read = await store.readLatest(10);
    expect(read.kind).toBe("ok");
    if (read.kind === "ok") {
      expect(read.value).toHaveLength(1);
      expect(read.value[0].deadFileCount).toBe(3);
    }
  });

  it("readLatest returns [] when no history exists (ENOENT is not an error)", async () => {
    const read = await store.readLatest(10);
    expect(read.kind).toBe("ok");
    if (read.kind === "ok") expect(read.value).toEqual([]);
  });

  it("readLatest returns the newest N in oldest→newest order", async () => {
    for (let i = 0; i < 5; i++) {
      await store.append(snapshot({ timestampMs: 1000 + i, uncommittedCount: i }));
    }
    const read = await store.readLatest(3);
    expect(read.kind).toBe("ok");
    if (read.kind === "ok") {
      expect(read.value.map((s) => s.uncommittedCount)).toEqual([2, 3, 4]);
    }
  });

  it("rejects appends with an unsupported schemaVersion", async () => {
    const bad = { ...snapshot(), schemaVersion: 99 } as unknown as PulseSnapshotV1;
    const result = await store.append(bad);
    expect(result.kind).toBe("err");
    if (result.kind === "err") expect(result.error.code).toBe("PULSE_VERSION_UNSUPPORTED");
  });

  it("skips malformed and unsupported-version lines instead of failing the read", async () => {
    await store.append(snapshot({ uncommittedCount: 7 }));
    fs.appendFileSync(pulseFile(), "{not json\n" + JSON.stringify({ schemaVersion: 99 }) + "\n");
    await store.append(snapshot({ uncommittedCount: 8 }));

    const read = await store.readLatest(10);
    expect(read.kind).toBe("ok");
    if (read.kind === "ok") {
      expect(read.value.map((s) => s.uncommittedCount)).toEqual([7, 8]);
    }
  });

  it("tail-compacts past PULSE.MAX_SNAPSHOTS on append", async () => {
    const lines = Array.from({ length: PULSE.MAX_SNAPSHOTS + 10 }, (_, i) =>
      JSON.stringify(snapshot({ timestampMs: i, uncommittedCount: i }))
    );
    fs.mkdirSync(path.dirname(pulseFile()), { recursive: true });
    fs.writeFileSync(pulseFile(), lines.join("\n") + "\n");

    await store.append(snapshot({ uncommittedCount: 12345 }));

    const raw = fs.readFileSync(pulseFile(), "utf8").trim().split("\n");
    expect(raw.length).toBe(PULSE.MAX_SNAPSHOTS);
    expect(JSON.parse(raw[raw.length - 1]).uncommittedCount).toBe(12345);
  });
});
