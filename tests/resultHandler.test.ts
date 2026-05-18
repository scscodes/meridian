import { describe, it, expect } from "vitest";
import { formatResultMessage } from "../src/infrastructure/result-handler";
import { success, failure } from "../src/types";
import type { Result } from "../src/types";

describe("formatResultMessage", () => {
  // -----------------------------------------------------------------------
  // 1. Error with known code → friendly message
  // -----------------------------------------------------------------------
  it("maps known error code to friendly message", () => {
    const result: Result<unknown> = failure({
      code: "GIT_STATUS_ERROR",
      message: "git rev-parse failed",
    });
    const msg = formatResultMessage("git.status", result);

    expect(msg.level).toBe("error");
    expect(msg.message).toContain("Failed to read git status.");
  });

  // -----------------------------------------------------------------------
  // 2. Error with unknown code → raw error.message used
  // -----------------------------------------------------------------------
  it("falls back to raw error message for unknown code", () => {
    const result: Result<unknown> = failure({
      code: "SOME_UNKNOWN_CODE",
      message: "Something unexpected happened",
    });
    const msg = formatResultMessage("git.commit", result);

    expect(msg.level).toBe("error");
    expect(msg.message).toContain("Something unexpected happened");
  });

  // -----------------------------------------------------------------------
  // 3. git.status success → branch name and dirty/clean
  // -----------------------------------------------------------------------
  it("formats git.status success with branch and dirty state", () => {
    const result = success({
      branch: "main",
      isDirty: true,
      staged: 2,
      unstaged: 3,
      untracked: 1,
    });
    const msg = formatResultMessage("git.status", result);

    expect(msg.level).toBe("info");
    expect(msg.message).toContain("main");
    expect(msg.message).toContain("dirty");
    expect(msg.message).toContain("staged: 2");
    expect(msg.message).toContain("unstaged: 3");
    expect(msg.message).toContain("untracked: 1");
  });

  // -----------------------------------------------------------------------
  // 4. hygiene.scan success → dead/large/logs counts
  // -----------------------------------------------------------------------
  it("formats hygiene.scan success with category counts", () => {
    const result = success({
      deadFiles: ["a.tmp"],
      largeFiles: [
        { path: "b.bin", sizeBytes: 12000000 },
        { path: "c.bin", sizeBytes: 15000000 },
      ],
      logFiles: [],
      markdownFiles: [],
      deadCode: { items: [], tsconfigPath: null, durationMs: 0, fileCount: 0 },
    });
    const msg = formatResultMessage("hygiene.scan", result);

    expect(msg.level).toBe("info");
    expect(msg.message).toContain("dead: 1");
    expect(msg.message).toContain("large: 2");
    expect(msg.message).toContain("logs: 0");
  });

  // -----------------------------------------------------------------------
  // 5. Unknown command success → generic OK
  // -----------------------------------------------------------------------
  it("returns generic OK for unrecognized command names", () => {
    const result = success({ anything: true });
    const msg = formatResultMessage("custom.unknown", result);

    expect(msg.level).toBe("info");
    expect(msg.message).toContain("custom.unknown");
    expect(msg.message).toContain("OK");
  });
});
