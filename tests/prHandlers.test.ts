import { describe, it, expect, vi } from "vitest";
import {
  parseNumstatOutput,
  gatherPRContext,
  createGeneratePRHandler,
  createReviewPRHandler,
  createCommentPRHandler,
  createResolveConflictsHandler,
  GenerateProseFn,
} from "../src/domains/git/pr-handlers";
import {
  MockGitProvider,
  MockLogger,
  createMockContext,
  assertSuccess,
  assertFailure,
} from "./fixtures";
import { success, failure, Result } from "../src/types";

// ============================================================================
// parseNumstatOutput
// ============================================================================

describe("parseNumstatOutput", () => {
  it("parses standard numstat lines with path, additions, deletions, status", () => {
    const raw = "10\t5\tsrc/foo.ts\n20\t3\tsrc/bar.ts";
    const result = parseNumstatOutput(raw);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ path: "src/foo.ts", status: "M", additions: 10, deletions: 5 });
    expect(result[1]).toEqual({ path: "src/bar.ts", status: "M", additions: 20, deletions: 3 });
  });

  it("returns empty array for empty input", () => {
    expect(parseNumstatOutput("")).toEqual([]);
    expect(parseNumstatOutput("   \n  \n")).toEqual([]);
  });

  it("skips malformed lines with fewer than 3 tab-separated parts", () => {
    const raw = "10\t5\tsrc/good.ts\nbadline\n10\t5\nonly-one-part";
    const result = parseNumstatOutput(raw);

    expect(result).toHaveLength(1);
    expect(result[0]!.path).toBe("src/good.ts");
  });

  it("handles binary markers (- - path) as 0/0 additions/deletions with status M", () => {
    const raw = "-\t-\tsrc/image.png";
    const result = parseNumstatOutput(raw);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ path: "src/image.png", status: "M", additions: 0, deletions: 0 });
  });

  it("assigns status A when only additions are present (deletions = 0)", () => {
    const raw = "15\t0\tsrc/new-file.ts";
    const result = parseNumstatOutput(raw);

    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe("A");
    expect(result[0]!.additions).toBe(15);
    expect(result[0]!.deletions).toBe(0);
  });

  it("assigns status D when only deletions are present (additions = 0)", () => {
    const raw = "0\t25\tsrc/removed.ts";
    const result = parseNumstatOutput(raw);

    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe("D");
    expect(result[0]!.additions).toBe(0);
    expect(result[0]!.deletions).toBe(25);
  });
});

// ============================================================================
// gatherPRContext
// ============================================================================

describe("gatherPRContext", () => {
  it("returns PRContext with branch, targetBranch, commits, changes, and diff on happy path", async () => {
    const git = new MockGitProvider();
    git.setCurrentBranch("feat/new-thing");
    git.setDiff("10\t5\tsrc/foo.ts");

    const result = await gatherPRContext(git as any);
    const ctx = assertSuccess(result);

    expect(ctx.branch).toBe("feat/new-thing");
    expect(ctx.targetBranch).toBe("main");
    expect(ctx.commits).toEqual([]);
    expect(ctx.changes).toHaveLength(1);
    expect(ctx.changes[0]!.path).toBe("src/foo.ts");
    expect(ctx.diff).toContain("diff");
  });

  it("returns failure NO_CHANGES when numstat produces empty changes", async () => {
    const git = new MockGitProvider();
    git.setCurrentBranch("feat/empty");
    // Default diffOutput is "" — numstat will parse to 0 changes
    // But diff() prepends "diff <revision>\n" so the raw will be "diff abc0000...HEAD\n"
    // parseNumstatOutput on "diff abc0000...HEAD\n" — "diff abc0000...HEAD" has no tabs → skipped → 0 changes

    const result = await gatherPRContext(git as any);
    const err = assertFailure(result);

    expect(err.code).toBe("NO_CHANGES");
  });

  it("propagates getCurrentBranch error", async () => {
    const git = new MockGitProvider();
    vi.spyOn(git, "getCurrentBranch").mockResolvedValueOnce(
      failure({ code: "GIT_UNAVAILABLE", message: "no git repo" })
    );

    const result = await gatherPRContext(git as any);
    const err = assertFailure(result);

    expect(err.code).toBe("GIT_UNAVAILABLE");
  });

  it("propagates getCommitRange error", async () => {
    const git = new MockGitProvider();
    git.setCurrentBranch("feat/x");
    vi.spyOn(git, "getCommitRange").mockResolvedValueOnce(
      failure({ code: "GIT_STATUS_ERROR", message: "commit range failed" })
    );

    const result = await gatherPRContext(git as any);
    const err = assertFailure(result);

    expect(err.code).toBe("GIT_STATUS_ERROR");
  });

  it("falls back to targetBranch when getMergeBase fails", async () => {
    const git = new MockGitProvider();
    git.setCurrentBranch("feat/fallback");
    git.setDiff("5\t2\tsrc/a.ts");

    vi.spyOn(git, "getMergeBase").mockResolvedValueOnce(
      failure({ code: "GIT_STATUS_ERROR", message: "merge-base not found" })
    );

    // getCommitRange and diff should use "main" (targetBranch) as the range base
    const commitRangeSpy = vi.spyOn(git, "getCommitRange");
    const diffSpy = vi.spyOn(git, "diff");

    const result = await gatherPRContext(git as any, "main");
    const ctx = assertSuccess(result);

    // rangeBase should be "main" since getMergeBase failed
    expect(commitRangeSpy).toHaveBeenCalledWith("main", "HEAD");
    expect(diffSpy).toHaveBeenCalledWith("main...HEAD", ["--numstat"]);
    expect(ctx.changes).toHaveLength(1);
  });

  it("propagates numstat diff failure", async () => {
    const git = new MockGitProvider();
    git.setCurrentBranch("feat/diff-fail");

    vi.spyOn(git, "diff").mockResolvedValueOnce(
      failure({ code: "GIT_STATUS_ERROR", message: "diff failed" })
    );

    const result = await gatherPRContext(git as any);
    const err = assertFailure(result);

    expect(err.code).toBe("GIT_STATUS_ERROR");
  });

  it("sets diff to '(diff unavailable)' when second diff call fails but changes exist", async () => {
    const git = new MockGitProvider();
    git.setCurrentBranch("feat/partial-diff");

    // First diff call (numstat) succeeds, second diff call (full) fails
    const diffSpy = vi.spyOn(git, "diff");
    diffSpy
      .mockResolvedValueOnce(success("10\t5\tsrc/foo.ts"))   // numstat
      .mockResolvedValueOnce(failure({ code: "GIT_STATUS_ERROR", message: "diff too large" }));  // full diff

    const result = await gatherPRContext(git as any);
    const ctx = assertSuccess(result);

    expect(ctx.changes).toHaveLength(1);
    expect(ctx.diff).toBe("(diff unavailable)");
  });
});

// ============================================================================
// createGeneratePRHandler
// ============================================================================

describe("createGeneratePRHandler", () => {
  const ctx = createMockContext();

  function setup() {
    const git = new MockGitProvider();
    const logger = new MockLogger();
    const generateProseFn = vi.fn<Parameters<GenerateProseFn>, ReturnType<GenerateProseFn>>();

    git.setCurrentBranch("feat/awesome");
    git.setDiff("10\t5\tsrc/foo.ts");

    return { git, logger, generateProseFn };
  }

  it("extracts title from # line, returns body and branch on success", async () => {
    const { git, logger, generateProseFn } = setup();
    const proseText = "# feat: something awesome\n\n## Summary\nDid the thing.";
    generateProseFn.mockResolvedValueOnce(success(proseText));

    const handler = createGeneratePRHandler(git as any, logger, generateProseFn);
    const result = await handler(ctx, {});
    const pr = assertSuccess(result);

    expect(pr.title).toBe("feat: something awesome");
    expect(pr.body).toBe(proseText);
    expect(pr.branch).toBe("feat/awesome");
  });

  it("propagates context failure from gatherPRContext", async () => {
    const { git, logger, generateProseFn } = setup();
    vi.spyOn(git, "getCurrentBranch").mockResolvedValueOnce(
      failure({ code: "GIT_UNAVAILABLE", message: "no repo" })
    );

    const handler = createGeneratePRHandler(git as any, logger, generateProseFn);
    const result = await handler(ctx, {});
    const err = assertFailure(result);

    expect(err.code).toBe("GIT_UNAVAILABLE");
    expect(generateProseFn).not.toHaveBeenCalled();
  });

  it("propagates prose generation failure", async () => {
    const { git, logger, generateProseFn } = setup();
    generateProseFn.mockResolvedValueOnce(
      failure({ code: "MODEL_UNAVAILABLE", message: "LLM down" })
    );

    const handler = createGeneratePRHandler(git as any, logger, generateProseFn);
    const result = await handler(ctx, {});
    const err = assertFailure(result);

    expect(err.code).toBe("MODEL_UNAVAILABLE");
  });
});

// ============================================================================
// createReviewPRHandler
// ============================================================================

describe("createReviewPRHandler", () => {
  const ctx = createMockContext();

  function setup() {
    const git = new MockGitProvider();
    const logger = new MockLogger();
    const generateProseFn = vi.fn<Parameters<GenerateProseFn>, ReturnType<GenerateProseFn>>();

    git.setCurrentBranch("feat/review");
    git.setDiff("10\t5\tsrc/foo.ts");

    return { git, logger, generateProseFn };
  }

  it("parses valid JSON into branch, summary, comments, and verdict", async () => {
    const { git, logger, generateProseFn } = setup();
    const jsonResponse = JSON.stringify({
      summary: "Looks good overall",
      verdict: "approve",
      comments: [
        { file: "src/foo.ts", severity: "nit", comment: "Consider renaming" },
      ],
    });
    generateProseFn.mockResolvedValueOnce(success(jsonResponse));

    const handler = createReviewPRHandler(git as any, logger, generateProseFn);
    const result = await handler(ctx, {});
    const review = assertSuccess(result);

    expect(review.branch).toBe("feat/review");
    expect(review.summary).toBe("Looks good overall");
    expect(review.verdict).toBe("approve");
    expect(review.comments).toHaveLength(1);
    expect(review.comments[0]!.file).toBe("src/foo.ts");
  });

  it("falls back to summary text when prose is not valid JSON", async () => {
    const { git, logger, generateProseFn } = setup();
    const rawText = "This code looks fine but needs some cleanup.";
    generateProseFn.mockResolvedValueOnce(success(rawText));

    const handler = createReviewPRHandler(git as any, logger, generateProseFn);
    const result = await handler(ctx, {});
    const review = assertSuccess(result);

    expect(review.branch).toBe("feat/review");
    expect(review.summary).toBe(rawText);
    expect(review.comments).toEqual([]);
    expect(review.verdict).toBe("comment");
  });

  it("propagates context failure", async () => {
    const { git, logger, generateProseFn } = setup();
    vi.spyOn(git, "getCurrentBranch").mockResolvedValueOnce(
      failure({ code: "GIT_UNAVAILABLE", message: "not a repo" })
    );

    const handler = createReviewPRHandler(git as any, logger, generateProseFn);
    const result = await handler(ctx, {});
    const err = assertFailure(result);

    expect(err.code).toBe("GIT_UNAVAILABLE");
    expect(generateProseFn).not.toHaveBeenCalled();
  });
});

// ============================================================================
// createCommentPRHandler
// ============================================================================

describe("createCommentPRHandler", () => {
  const ctx = createMockContext();

  function setup() {
    const git = new MockGitProvider();
    const logger = new MockLogger();
    const generateProseFn = vi.fn<Parameters<GenerateProseFn>, ReturnType<GenerateProseFn>>();

    git.setCurrentBranch("feat/comments");
    git.setDiff("10\t5\tsrc/foo.ts");

    return { git, logger, generateProseFn };
  }

  it("parses comments from valid JSON response", async () => {
    const { git, logger, generateProseFn } = setup();
    const jsonResponse = JSON.stringify({
      comments: [
        { file: "src/foo.ts", line: 10, comment: "Check null here" },
        { file: "src/bar.ts", line: null, comment: "Missing validation" },
      ],
    });
    generateProseFn.mockResolvedValueOnce(success(jsonResponse));

    const handler = createCommentPRHandler(git as any, logger, generateProseFn);
    const result = await handler(ctx, {});
    const comments = assertSuccess(result);

    expect(comments.branch).toBe("feat/comments");
    expect(comments.comments).toHaveLength(2);
    expect(comments.comments[0]!.file).toBe("src/foo.ts");
    expect(comments.comments[1]!.comment).toBe("Missing validation");
  });

  it("passes filterPaths in data when params.paths is provided", async () => {
    const { git, logger, generateProseFn } = setup();
    generateProseFn.mockResolvedValueOnce(
      success(JSON.stringify({ comments: [] }))
    );

    const handler = createCommentPRHandler(git as any, logger, generateProseFn);
    await handler(ctx, { paths: ["src/foo.ts", "src/bar.ts"] });

    expect(generateProseFn).toHaveBeenCalledTimes(1);
    const callData = generateProseFn.mock.calls[0]![0]!.data;
    expect(callData.filterPaths).toEqual(["src/foo.ts", "src/bar.ts"]);
  });
});

// ============================================================================
// createResolveConflictsHandler
// ============================================================================

describe("createResolveConflictsHandler", () => {
  const ctx = createMockContext();

  function setup() {
    const git = new MockGitProvider();
    const logger = new MockLogger();
    const generateProseFn = vi.fn<Parameters<GenerateProseFn>, ReturnType<GenerateProseFn>>();
    const mockAnalyzer = {
      analyze: vi.fn(),
    };

    return { git, logger, generateProseFn, mockAnalyzer };
  }

  it("parses JSON response into overview and perFile on success", async () => {
    const { git, logger, generateProseFn, mockAnalyzer } = setup();

    mockAnalyzer.analyze.mockResolvedValueOnce(
      success({
        branch: "main",
        totalInbound: 5,
        totalLocal: 3,
        conflicts: [
          { path: "src/service.ts", localStatus: "M", remoteStatus: "M", severity: "high", localChanges: 10, remoteChanges: 8 },
        ],
        summary: { description: "1 conflict", conflicts: { high: 1, medium: 0, low: 0 }, fileTypes: { ".ts": 1 }, recommendations: [] },
        diffLink: "",
        remote: "origin",
      })
    );

    const jsonResponse = JSON.stringify({
      overview: "One high-severity conflict in service.ts",
      perFile: [
        { path: "src/service.ts", strategy: "manual-merge", rationale: "Overlapping logic", suggestedSteps: ["Review both sides"] },
      ],
    });
    generateProseFn.mockResolvedValueOnce(success(jsonResponse));

    const handler = createResolveConflictsHandler(git as any, logger, mockAnalyzer as any, generateProseFn);
    const result = await handler(ctx, {} as any);
    const resolution = assertSuccess(result);

    expect(resolution.overview).toBe("One high-severity conflict in service.ts");
    expect(resolution.perFile).toHaveLength(1);
    expect(resolution.perFile[0]!.strategy).toBe("manual-merge");
  });

  it("returns failure NO_CHANGES when no conflicts exist", async () => {
    const { git, logger, generateProseFn, mockAnalyzer } = setup();

    mockAnalyzer.analyze.mockResolvedValueOnce(
      success({
        branch: "main",
        totalInbound: 3,
        totalLocal: 2,
        conflicts: [],
        summary: { description: "no conflicts", conflicts: { high: 0, medium: 0, low: 0 }, fileTypes: {}, recommendations: [] },
        diffLink: "",
        remote: "origin",
      })
    );

    const handler = createResolveConflictsHandler(git as any, logger, mockAnalyzer as any, generateProseFn);
    const result = await handler(ctx, {} as any);
    const err = assertFailure(result);

    expect(err.code).toBe("NO_CHANGES");
    expect(generateProseFn).not.toHaveBeenCalled();
  });

  it("falls back to raw text overview with empty perFile when JSON parse fails", async () => {
    const { git, logger, generateProseFn, mockAnalyzer } = setup();

    mockAnalyzer.analyze.mockResolvedValueOnce(
      success({
        branch: "main",
        totalInbound: 2,
        totalLocal: 1,
        conflicts: [
          { path: "src/utils.ts", localStatus: "M", remoteStatus: "M", severity: "medium", localChanges: 5, remoteChanges: 3 },
        ],
        summary: { description: "1 conflict", conflicts: { high: 0, medium: 1, low: 0 }, fileTypes: { ".ts": 1 }, recommendations: [] },
        diffLink: "",
        remote: "origin",
      })
    );

    const rawText = "You should manually merge src/utils.ts because both sides changed the same function.";
    generateProseFn.mockResolvedValueOnce(success(rawText));

    const handler = createResolveConflictsHandler(git as any, logger, mockAnalyzer as any, generateProseFn);
    const result = await handler(ctx, {} as any);
    const resolution = assertSuccess(result);

    expect(resolution.overview).toBe(rawText);
    expect(resolution.perFile).toEqual([]);
  });
});
