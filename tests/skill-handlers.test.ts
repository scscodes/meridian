import { describe, it, expect, vi } from "vitest";

vi.mock("vscode", () => ({}));

import { createOverviewHandler, createPrReadyHandler, createPreMergeHandler } from "../src/domains/skill/handlers";
import { createMockContext, MockLogger, assertSuccess, assertFailure } from "./fixtures";

// Mock dispatcher factory
function createMockDispatcher(results: Record<string, any>) {
  return vi.fn().mockImplementation(async (cmd: any) => {
    const key = cmd.name;
    if (key in results) {
      return results[key];
    }
    return { kind: "err", error: { code: "NOT_FOUND", message: `No mock for ${key}` } };
  });
}

// ── Realistic mock data ─────────────────────────────────────────────────────

const MOCK_GIT_STATUS = {
  branch: "feature/skill-domain",
  isDirty: true,
  staged: 3,
  unstaged: 2,
  untracked: 1,
};

const MOCK_BRIEFING = "## Session Briefing\n\nBranch `feature/skill-domain` has 3 staged changes.";

const MOCK_SCAN = {
  deadFiles: [],
  largeFiles: [{ path: "data/dump.sql", sizeBytes: 5_000_000 }],
  logFiles: ["logs/app.log"],
  markdownFiles: [],
  deadCode: { items: [], tsconfigPath: null, durationMs: 120, fileCount: 50 },
};

const MOCK_REVIEW = {
  branch: "feature/skill-domain",
  summary: "Clean implementation with minor suggestions.",
  comments: [{ file: "src/main.ts", severity: "suggestion" as const, comment: "Consider extracting helper" }],
  verdict: "approve" as const,
};

const MOCK_PR = {
  title: "feat: add skill domain",
  body: "## Summary\nAdds composite skill commands.",
  branch: "feature/skill-domain",
};

const MOCK_INBOUND = {
  remote: "origin",
  branch: "main",
  totalInbound: 5,
  totalLocal: 3,
  conflicts: [
    { path: "src/types.ts", localStatus: "M" as const, remoteStatus: "M" as const, severity: "high" as const, localChanges: 10, remoteChanges: 8 },
  ],
  summary: {
    description: "1 conflict in 5 inbound changes",
    conflicts: { high: 1, medium: 0, low: 0 },
    fileTypes: { ".ts": 4, ".json": 1 },
    recommendations: ["Review conflict in src/types.ts"],
  },
  diffLink: "https://github.com/test/repo/compare/main...feature",
};

const MOCK_CONFLICTS = {
  overview: "1 file requires manual resolution.",
  perFile: [
    { path: "src/types.ts", strategy: "manual-merge" as const, rationale: "Both branches modified the CommandName union.", suggestedSteps: ["Open merge tool"] },
  ],
};

// ── skill.overview ──────────────────────────────────────────────────────────

describe("skill.overview handler", () => {
  it("returns combined status + briefing on success", async () => {
    const dispatcher = createMockDispatcher({
      "git.status": { kind: "ok", value: MOCK_GIT_STATUS },
      "git.sessionBriefing": { kind: "ok", value: MOCK_BRIEFING },
    });
    const handler = createOverviewHandler(dispatcher, new MockLogger());
    const result = await handler(createMockContext(), {} as any);

    const value = assertSuccess(result);
    expect(value.status).toEqual(MOCK_GIT_STATUS);
    expect(value.briefing).toBe(MOCK_BRIEFING);
    expect(dispatcher).toHaveBeenCalledTimes(2);
  });

  it("fails when git.status fails", async () => {
    const dispatcher = createMockDispatcher({
      "git.status": { kind: "err", error: { code: "GIT_STATUS_ERROR", message: "no repo" } },
    });
    const handler = createOverviewHandler(dispatcher, new MockLogger());
    const result = await handler(createMockContext(), {} as any);

    const err = assertFailure(result);
    expect(err.code).toBe("SKILL_STEP_FAILED");
    expect(err.message).toContain("git.status");
    // Should not have called the second command
    expect(dispatcher).toHaveBeenCalledTimes(1);
  });

  it("fails when git.sessionBriefing fails", async () => {
    const dispatcher = createMockDispatcher({
      "git.status": { kind: "ok", value: MOCK_GIT_STATUS },
      "git.sessionBriefing": { kind: "err", error: { code: "MODEL_UNAVAILABLE", message: "no model" } },
    });
    const handler = createOverviewHandler(dispatcher, new MockLogger());
    const result = await handler(createMockContext(), {} as any);

    const err = assertFailure(result);
    expect(err.code).toBe("SKILL_STEP_FAILED");
    expect(err.message).toContain("git.sessionBriefing");
  });
});

// ── skill.prReady ───────────────────────────────────────────────────────────

describe("skill.prReady handler", () => {
  it("returns scan + review + PR on success", async () => {
    const dispatcher = createMockDispatcher({
      "hygiene.scan": { kind: "ok", value: MOCK_SCAN },
      "git.reviewPR": { kind: "ok", value: MOCK_REVIEW },
      "git.generatePR": { kind: "ok", value: MOCK_PR },
    });
    const handler = createPrReadyHandler(dispatcher, new MockLogger());
    const result = await handler(createMockContext(), {} as any);

    const value = assertSuccess(result);
    expect(value.scan).toEqual(MOCK_SCAN);
    expect(value.review.verdict).toBe("approve");
    expect(value.pr.title).toBe("feat: add skill domain");
    expect(dispatcher).toHaveBeenCalledTimes(3);
  });

  it("fails when hygiene.scan fails (first step)", async () => {
    const dispatcher = createMockDispatcher({
      "hygiene.scan": { kind: "err", error: { code: "HYGIENE_SCAN_ERROR", message: "scan failed" } },
    });
    const handler = createPrReadyHandler(dispatcher, new MockLogger());
    const result = await handler(createMockContext(), {} as any);

    const err = assertFailure(result);
    expect(err.code).toBe("SKILL_STEP_FAILED");
    expect(err.message).toContain("hygiene.scan");
    expect(dispatcher).toHaveBeenCalledTimes(1);
  });

  it("fails when git.reviewPR fails (middle step)", async () => {
    const dispatcher = createMockDispatcher({
      "hygiene.scan": { kind: "ok", value: MOCK_SCAN },
      "git.reviewPR": { kind: "err", error: { code: "PR_REVIEW_ERROR", message: "review failed" } },
    });
    const handler = createPrReadyHandler(dispatcher, new MockLogger());
    const result = await handler(createMockContext(), {} as any);

    const err = assertFailure(result);
    expect(err.code).toBe("SKILL_STEP_FAILED");
    expect(err.message).toContain("git.reviewPR");
    // Should not have called the third command
    expect(dispatcher).toHaveBeenCalledTimes(2);
  });

  it("fails when git.generatePR fails (last step)", async () => {
    const dispatcher = createMockDispatcher({
      "hygiene.scan": { kind: "ok", value: MOCK_SCAN },
      "git.reviewPR": { kind: "ok", value: MOCK_REVIEW },
      "git.generatePR": { kind: "err", error: { code: "PR_GENERATION_ERROR", message: "generation failed" } },
    });
    const handler = createPrReadyHandler(dispatcher, new MockLogger());
    const result = await handler(createMockContext(), {} as any);

    const err = assertFailure(result);
    expect(err.code).toBe("SKILL_STEP_FAILED");
    expect(err.message).toContain("git.generatePR");
  });
});

// ── skill.preMerge ──────────────────────────────────────────────────────────

describe("skill.preMerge handler", () => {
  it("returns inbound + conflicts on success", async () => {
    const dispatcher = createMockDispatcher({
      "git.analyzeInbound": { kind: "ok", value: MOCK_INBOUND },
      "git.resolveConflicts": { kind: "ok", value: MOCK_CONFLICTS },
    });
    const handler = createPreMergeHandler(dispatcher, new MockLogger());
    const result = await handler(createMockContext(), {} as any);

    const value = assertSuccess(result);
    expect(value.inbound.totalInbound).toBe(5);
    expect(value.conflicts.perFile).toHaveLength(1);
    expect(dispatcher).toHaveBeenCalledTimes(2);
  });

  it("fails when git.analyzeInbound fails", async () => {
    const dispatcher = createMockDispatcher({
      "git.analyzeInbound": { kind: "err", error: { code: "INBOUND_ANALYSIS_ERROR", message: "fetch failed" } },
    });
    const handler = createPreMergeHandler(dispatcher, new MockLogger());
    const result = await handler(createMockContext(), {} as any);

    const err = assertFailure(result);
    expect(err.code).toBe("SKILL_STEP_FAILED");
    expect(err.message).toContain("git.analyzeInbound");
    expect(dispatcher).toHaveBeenCalledTimes(1);
  });

  it("fails when git.resolveConflicts fails", async () => {
    const dispatcher = createMockDispatcher({
      "git.analyzeInbound": { kind: "ok", value: MOCK_INBOUND },
      "git.resolveConflicts": { kind: "err", error: { code: "CONFLICT_RESOLUTION_ERROR", message: "no model" } },
    });
    const handler = createPreMergeHandler(dispatcher, new MockLogger());
    const result = await handler(createMockContext(), {} as any);

    const err = assertFailure(result);
    expect(err.code).toBe("SKILL_STEP_FAILED");
    expect(err.message).toContain("git.resolveConflicts");
  });
});
