import { describe, expect, it } from "vitest";
import { LM_TOOL_DEFS } from "../src/infrastructure/command-catalog";
import { buildLmToolEnvelope } from "../src/infrastructure/lm-envelope";
import { failure, success } from "../src/types";

describe("lm-envelope", () => {
  it("returns a valid envelope shape for every LM command success path", () => {
    for (const tool of LM_TOOL_DEFS) {
      const envelope = buildLmToolEnvelope(tool.commandName, success({}));
      expect(typeof envelope.summary).toBe("string");
      expect(envelope).toHaveProperty("data");
      expect(Array.isArray(envelope.followups)).toBe(true);
      expect(typeof envelope.renderHint).toBe("string");
    }
  });

  it("normalizes errors into the same envelope contract", () => {
    const envelope = buildLmToolEnvelope(
      "git.status",
      failure({ code: "GIT_UNAVAILABLE", message: "git not installed", details: { test: true } })
    );
    expect(envelope.summary).toContain("Git is not available");
    expect(envelope.renderHint).toBe("status");
    const data = envelope.data as { code: string; message: string };
    expect(data.code).toBe("GIT_UNAVAILABLE");
    expect(data.message).toBe("git not installed");
  });
});
