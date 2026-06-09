import { describe, it, expect, vi, beforeEach } from "vitest";
import { createShowHygieneAnalyticsHandler } from "../src/domains/hygiene/analytics-handler";
import {
  MockLogger,
  MockDeadCodeAnalyzer,
  createMockContext,
  assertSuccess,
  assertFailure,
} from "./fixtures";
import type { CommandContext, DeadCodeScan } from "../src/types";
import type { HygieneAnalyticsReport } from "../src/domains/hygiene/analytics-types";

describe("hygiene.showAnalytics (createShowHygieneAnalyticsHandler)", () => {
  let logger: MockLogger;
  let deadCodeAnalyzer: MockDeadCodeAnalyzer;
  let ctx: CommandContext;
  const mockAnalyzer = { analyze: vi.fn() };

  function buildHandler() {
    return createShowHygieneAnalyticsHandler(
      mockAnalyzer as any,
      deadCodeAnalyzer as any,
      logger
    );
  }

  function buildReport(
    overrides: Partial<HygieneAnalyticsReport> = {}
  ): HygieneAnalyticsReport {
    return {
      generatedAt: new Date(),
      workspaceRoot: "/workspace",
      summary: {
        totalFiles: 10,
        totalSizeBytes: 5000,
        pruneCount: 2,
        pruneEstimateSizeBytes: 1000,
        byCategory: {},
      },
      files: [],
      pruneCandiates: [],
      largestFiles: [],
      oldestFiles: [],
      temporalData: { buckets: [], topExtensions: [] },
      pruneConfig: {
        minAgeDays: 30,
        maxSizeMB: 1,
        minLineCount: 0,
        categories: ["backup", "temp", "log", "artifact"],
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    logger = new MockLogger();
    deadCodeAnalyzer = new MockDeadCodeAnalyzer();
    ctx = createMockContext();
    vi.resetAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1. Success — returns report from analyzer
  // -----------------------------------------------------------------------
  it("returns report from analyzer on success", async () => {
    const report = buildReport();
    mockAnalyzer.analyze.mockReturnValue(report);

    const handler = buildHandler();
    const result = await handler(ctx, {});
    const value = assertSuccess(result);

    expect(value).toEqual(report);
    expect(value.summary.totalFiles).toBe(10);
    expect(value.summary.pruneCount).toBe(2);
    expect(mockAnalyzer.analyze).toHaveBeenCalledOnce();
  });

  // -----------------------------------------------------------------------
  // 2. Config merge — partial params merged with PRUNE_DEFAULTS
  // -----------------------------------------------------------------------
  it("merges partial params with PRUNE_DEFAULTS", async () => {
    const report = buildReport();
    mockAnalyzer.analyze.mockReturnValue(report);

    const handler = buildHandler();
    await handler(ctx, { minAgeDays: 7 });

    // Verify analyzer.analyze was called with merged config
    const [_root, config, _deadCode] = mockAnalyzer.analyze.mock.calls[0];
    expect(config.minAgeDays).toBe(7);
    expect(config.maxSizeMB).toBe(1); // default
    expect(config.minLineCount).toBe(0); // default
    expect(config.categories).toEqual(["backup", "temp", "log", "artifact"]); // default
  });

  // -----------------------------------------------------------------------
  // 3. Dead code passed to analyzer
  // -----------------------------------------------------------------------
  it("calls deadCodeAnalyzer first and passes result to analyzer", async () => {
    const deadCodeScan: DeadCodeScan = {
      items: [
        {
          filePath: "/workspace/src/unused.ts",
          line: 10,
          character: 1,
          message: "'bar' is declared but never used.",
          code: 6133,
          category: "unusedLocal",
        },
      ],
      tsconfigPath: "/workspace/tsconfig.json",
      durationMs: 50,
      fileCount: 5,
    };
    deadCodeAnalyzer.setResult(deadCodeScan);

    const report = buildReport();
    mockAnalyzer.analyze.mockReturnValue(report);

    const handler = buildHandler();
    await handler(ctx, {});

    // Verify deadCodeAnalyzer.analyze was called with workspaceRoot
    const workspaceRoot = ctx.workspaceFolders![0];

    // Verify analyzer.analyze received the dead code scan as third arg
    const [root, _config, passedDeadCode] = mockAnalyzer.analyze.mock.calls[0];
    expect(root).toBe(workspaceRoot);
    expect(passedDeadCode).toEqual(deadCodeScan);
    expect(passedDeadCode.items).toHaveLength(1);
    expect(passedDeadCode.items[0].code).toBe(6133);
  });

  // -----------------------------------------------------------------------
  // 4. Thrown error — returns HYGIENE_ANALYTICS_ERROR
  // -----------------------------------------------------------------------
  it("returns HYGIENE_ANALYTICS_ERROR when analyzer throws", async () => {
    mockAnalyzer.analyze.mockImplementation(() => {
      throw new Error("disk full");
    });

    const handler = buildHandler();
    const result = await handler(ctx, {});
    const err = assertFailure(result);

    expect(err.code).toBe("HYGIENE_ANALYTICS_ERROR");
    expect(err.message).toBe("Hygiene analytics failed");
    expect(err.context).toBe("hygiene.showAnalytics");
  });
});
