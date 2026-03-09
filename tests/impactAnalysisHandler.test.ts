/**
 * Impact Analysis Handler Tests — covers all branches of createImpactAnalysisHandler
 * and the ImpactAnalyzer layer beneath it, mocking the TypeScript Compiler API
 * and ImpactAnalysisVisitor so no real filesystem access is needed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { success, failure } from "../src/types";
import type { GenerateProseFn } from "../src/types";
import { MockLogger } from "./fixtures";

// ── Mock TypeScript compiler API ──────────────────────────────────────────────
vi.mock("typescript", () => ({
  findConfigFile: vi.fn().mockReturnValue("/ws/tsconfig.json"),
  readConfigFile: vi.fn().mockReturnValue({ config: {}, error: undefined }),
  parseJsonConfigFileContent: vi.fn().mockReturnValue({
    fileNames: ["/ws/src/main.ts"],
    options: {},
  }),
  createProgram: vi.fn().mockReturnValue({}),
  sys: { fileExists: vi.fn().mockReturnValue(true), readFile: vi.fn() },
}));

// ── Mock ImpactAnalysisVisitor ────────────────────────────────────────────────
const mockVisitorAnalyze = vi.fn().mockReturnValue({
  importers:  ["/ws/src/a.ts", "/ws/src/b.ts"],
  callSites:  ["/ws/src/c.ts:42"],
  testFiles:  ["/ws/tests/a.test.ts"],
});

vi.mock("../src/domains/hygiene/impact-visitor", () => ({
  ImpactAnalysisVisitor: vi.fn().mockImplementation(() => ({
    analyze: mockVisitorAnalyze,
  })),
}));

import { createImpactAnalysisHandler } from "../src/domains/hygiene/impact-analysis-handler";
import type { CommandContext } from "../src/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_CTX: CommandContext = {
  extensionPath: "/ext",
  workspaceFolders: ["/ws"],
};

const CTX_NO_WORKSPACE: CommandContext = {
  extensionPath: "/ext",
  workspaceFolders: [],
};

function makeGenerateProse(result = success("**Impact:** 2 importers, 1 test file.")): GenerateProseFn {
  return vi.fn().mockResolvedValue(result);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createImpactAnalysisHandler", () => {
  let logger: MockLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new MockLogger();
    // Restore default visitor mock after clearAllMocks
    mockVisitorAnalyze.mockReturnValue({
      importers:  ["/ws/src/a.ts", "/ws/src/b.ts"],
      callSites:  ["/ws/src/c.ts:42"],
      testFiles:  ["/ws/tests/a.test.ts"],
    });
  });

  // ── Input validation ────────────────────────────────────────────────────────

  it("returns INVALID_PARAMS when neither filePath nor functionName provided", async () => {
    const handler = createImpactAnalysisHandler(logger);
    const result = await handler(BASE_CTX, {});

    expect(result.kind).toBe("err");
    if (result.kind === "err") {
      expect(result.error.code).toBe("INVALID_PARAMS");
    }
  });

  it("returns WORKSPACE_NOT_FOUND when no workspace folders", async () => {
    const handler = createImpactAnalysisHandler(logger);
    const result = await handler(CTX_NO_WORKSPACE, { filePath: "/ws/src/main.ts" });

    expect(result.kind).toBe("err");
    if (result.kind === "err") {
      expect(result.error.code).toBe("WORKSPACE_NOT_FOUND");
    }
  });

  it("returns MODEL_UNAVAILABLE when generateProseFn not provided", async () => {
    const handler = createImpactAnalysisHandler(logger); // no prose fn
    const result = await handler(BASE_CTX, { filePath: "/ws/src/main.ts" });

    expect(result.kind).toBe("err");
    if (result.kind === "err") {
      expect(result.error.code).toBe("MODEL_UNAVAILABLE");
    }
  });

  // ── Analyzer failure paths ──────────────────────────────────────────────────

  it("returns IMPACT_ANALYSIS_ERROR when tsconfig not found", async () => {
    const ts = await import("typescript");
    vi.mocked(ts.findConfigFile).mockReturnValueOnce(undefined);

    const handler = createImpactAnalysisHandler(logger, makeGenerateProse());
    const result = await handler(BASE_CTX, { filePath: "/ws/src/main.ts" });

    expect(result.kind).toBe("err");
    if (result.kind === "err") {
      expect(result.error.code).toBe("IMPACT_ANALYSIS_ERROR");
    }
  });

  it("returns IMPACT_ANALYSIS_ERROR when tsconfig read fails", async () => {
    const ts = await import("typescript");
    vi.mocked(ts.readConfigFile).mockReturnValueOnce({ config: {}, error: { messageText: "bad" } as any });

    const handler = createImpactAnalysisHandler(logger, makeGenerateProse());
    const result = await handler(BASE_CTX, { filePath: "/ws/src/main.ts" });

    expect(result.kind).toBe("err");
    if (result.kind === "err") {
      expect(result.error.code).toBe("IMPACT_ANALYSIS_ERROR");
    }
  });

  // ── Prose generation paths ──────────────────────────────────────────────────

  it("forwards LLM error when generateProseFn fails", async () => {
    const proseErr = failure({ code: "MODEL_UNAVAILABLE", message: "Copilot offline" });
    const handler = createImpactAnalysisHandler(logger, makeGenerateProse(proseErr));
    const result = await handler(BASE_CTX, { filePath: "/ws/src/main.ts" });

    expect(result.kind).toBe("err");
    if (result.kind === "err") {
      expect(result.error.code).toBe("MODEL_UNAVAILABLE");
      expect(result.error.message).toContain("Copilot offline");
    }
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it("returns success with prose summary and correct metrics for filePath", async () => {
    const generateProse = makeGenerateProse();
    const handler = createImpactAnalysisHandler(logger, generateProse);
    const result = await handler(BASE_CTX, { filePath: "/ws/src/main.ts" });

    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.value.summary).toContain("2 importers");
      expect(result.value.metrics.importers).toBe(2);
      expect(result.value.metrics.callSites).toBe(1);
      expect(result.value.metrics.testFiles).toBe(1);
      expect(result.value.metrics.dependentFiles).toBe(3); // 2 importers + 1 test (deduped)
      expect(result.value.targetPath).toBe("/ws/src/main.ts");
      expect(result.value.targetFunction).toBeUndefined();
    }
  });

  it("returns success with correct metrics for functionName", async () => {
    const handler = createImpactAnalysisHandler(logger, makeGenerateProse());
    const result = await handler(BASE_CTX, { functionName: "createStatusHandler" });

    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.value.targetFunction).toBe("createStatusHandler");
      expect(result.value.targetPath).toBeUndefined();
    }
  });

  it("calls generateProseFn with correct domain and data shape", async () => {
    const generateProse = makeGenerateProse();
    const handler = createImpactAnalysisHandler(logger, generateProse);
    await handler(BASE_CTX, { filePath: "/ws/src/main.ts" });

    expect(generateProse).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: "hygiene",
        systemPrompt: expect.any(String),
        data: expect.objectContaining({
          importerCount: 2,
          callSiteCount: 1,
          testFileCount: 1,
        }),
      })
    );
  });

  it("returns success with empty metrics when visitor finds no dependents", async () => {
    mockVisitorAnalyze.mockReturnValueOnce({ importers: [], callSites: [], testFiles: [] });

    const handler = createImpactAnalysisHandler(logger, makeGenerateProse());
    const result = await handler(BASE_CTX, { filePath: "/ws/src/isolated.ts" });

    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.value.metrics.importers).toBe(0);
      expect(result.value.metrics.callSites).toBe(0);
      expect(result.value.metrics.testFiles).toBe(0);
      expect(result.value.metrics.dependentFiles).toBe(0);
    }
  });
});
