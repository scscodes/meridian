import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAnalyzeInboundHandler } from "../src/domains/git/inbound-handler";
import {
  MockLogger,
  createMockContext,
  assertSuccess,
  assertFailure,
} from "./fixtures";
import { success, failure } from "../src/types";
import type { CommandContext } from "../src/types";
import type { InboundChanges } from "../src/domains/git/types";

describe("git.analyzeInbound (createAnalyzeInboundHandler)", () => {
  let logger: MockLogger;
  let ctx: CommandContext;
  const mockAnalyzer = { analyze: vi.fn() };

  function buildHandler() {
    return createAnalyzeInboundHandler(mockAnalyzer as any, logger);
  }

  beforeEach(() => {
    logger = new MockLogger();
    ctx = createMockContext();
    vi.resetAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1. Success — returns the analysis value
  // -----------------------------------------------------------------------
  it("returns analysis value on success", async () => {
    const analysis: InboundChanges = {
      remote: "origin",
      branch: "main",
      totalInbound: 5,
      totalLocal: 3,
      conflicts: [],
      summary: {
        description: "5 changes",
        conflicts: { high: 0, medium: 0, low: 0 },
        fileTypes: {},
        recommendations: [],
      },
      diffLink: "https://github.com/owner/repo/compare/main...origin/main",
    };

    mockAnalyzer.analyze.mockResolvedValue(success(analysis));

    const handler = buildHandler();
    const result = await handler(ctx, {});
    const value = assertSuccess(result);

    expect(value).toEqual(analysis);
    expect(value.totalInbound).toBe(5);
    expect(value.conflicts).toEqual([]);
    expect(mockAnalyzer.analyze).toHaveBeenCalledOnce();
  });

  // -----------------------------------------------------------------------
  // 2. Error result from analyzer — propagated unchanged
  // -----------------------------------------------------------------------
  it("propagates error result from analyzer", async () => {
    const errorResult = failure({
      code: "GIT_FETCH_ERROR",
      message: "Could not reach remote",
    });

    mockAnalyzer.analyze.mockResolvedValue(errorResult);

    const handler = buildHandler();
    const result = await handler(ctx, {});
    const err = assertFailure(result);

    expect(err.code).toBe("GIT_FETCH_ERROR");
    expect(err.message).toBe("Could not reach remote");
    // Should have logged the error
    expect(logger.getByLevel("error")).toHaveLength(1);
    expect(logger.getByLevel("error")[0].message).toContain(
      "Failed to analyze inbound changes"
    );
  });

  // -----------------------------------------------------------------------
  // 3. Thrown exception — returns INBOUND_ANALYSIS_ERROR
  // -----------------------------------------------------------------------
  it("returns INBOUND_ANALYSIS_ERROR when analyzer throws", async () => {
    mockAnalyzer.analyze.mockRejectedValue(new Error("network timeout"));

    const handler = buildHandler();
    const result = await handler(ctx, {});
    const err = assertFailure(result);

    expect(err.code).toBe("INBOUND_ANALYSIS_ERROR");
    expect(err.message).toBe("Failed to analyze inbound changes");
    expect(err.context).toBe("git.analyzeInbound");
    expect(logger.getByLevel("error")).toHaveLength(1);
  });
});
