/**
 * PR-related Handlers — Generate, review, and resolve conflicts in pull requests.
 */

import {
  Handler,
  CommandContext,
  Result,
  success,
  failure,
  Logger,
  GitProvider,
} from "../../types";
import {
  PRGenerationParams,
  GeneratedPR,
  PRContext,
  PRReviewParams,
  GeneratedPRReview,
  PRCommentParams,
  GeneratedPRComments,
  ConflictResolutionProse,
} from "./types";
import { InboundAnalyzer } from "./inbound-analyzer";

/** Injected prose generation function — avoids transitive vscode import in tests. */
export type GenerateProseFn = (request: {
  domain: "hygiene" | "git" | "chat";
  systemPrompt: string;
  data: Record<string, unknown>;
}) => Promise<Result<string>>;

// ============================================================================
// Shared PR Context Gathering
// ============================================================================

/**
 * Shared context gather for PR-related prose consumers.
 * Uses branch-scoped data: commits, changes, and diff relative to targetBranch.
 */
export async function gatherPRContext(
  gitProvider: GitProvider,
  targetBranch: string = "main"
): Promise<Result<PRContext>> {
  // 1. Get current branch
  const branchResult = await gitProvider.getCurrentBranch();
  if (branchResult.kind === "err") return branchResult;
  const branch = branchResult.value.trim();

  // 2. Get commits on this branch since it diverged from targetBranch
  const commitsResult = await gitProvider.getCommitRange(targetBranch, "HEAD");
  if (commitsResult.kind === "err") return commitsResult;

  // 3. Get file-level change stats via numstat diff against targetBranch
  const rangeRef = `${targetBranch}...HEAD`;
  const numstatResult = await gitProvider.diff(rangeRef, ["--numstat"]);
  if (numstatResult.kind === "err") return numstatResult;

  const changes = parseNumstatOutput(numstatResult.value);

  if (changes.length === 0) {
    return failure({
      code: "NO_CHANGES",
      message: `No changes between ${targetBranch} and HEAD`,
      context: "gatherPRContext",
    });
  }

  // 4. Get full diff for LLM context (non-fatal if fails)
  const diffResult = await gitProvider.diff(rangeRef);

  return success({
    branch,
    targetBranch,
    commits: commitsResult.value,
    changes,
    diff: diffResult.kind === "ok" ? diffResult.value : "(diff unavailable)",
  });
}

/**
 * Parse `git diff --numstat` output into PRContext-compatible change entries.
 * Each line: `additions\tdeletions\tpath`
 */
function parseNumstatOutput(
  raw: string
): Array<{ path: string; status: "A" | "M" | "D" | "R"; additions: number; deletions: number }> {
  const results: Array<{ path: string; status: "A" | "M" | "D" | "R"; additions: number; deletions: number }> = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const additions = parseInt(parts[0] ?? "0", 10) || 0;
    const deletions = parseInt(parts[1] ?? "0", 10) || 0;
    const path = (parts[2] ?? "").trim();
    if (!path) continue;
    results.push({ path, status: "M", additions, deletions });
  }
  return results;
}

// ============================================================================
// PR Description Generation
// ============================================================================

const PR_GENERATION_PROMPT = `You are a PR description generator for a software project.
Given the branch name, recent commits, changed files with stats, and a diff, generate a pull request description.

Output format (markdown):
# <PR title in conventional commit style, e.g. "feat(git): add PR description generator">

## Summary
<2-3 sentences explaining what this PR does and why>

## Changes
<bulleted list of key changes, grouped by area>

## Test Plan
<how to verify these changes work correctly>

Guidelines:
- Keep the title under 72 characters
- Focus on the "why" not the "what" in the summary
- Group changes logically, not by file
- Be specific in the test plan`;

/**
 * git.generatePR — Generate a PR description from branch context using LLM.
 */
export function createGeneratePRHandler(
  gitProvider: GitProvider,
  logger: Logger,
  generateProseFn: GenerateProseFn
): Handler<PRGenerationParams, GeneratedPR> {
  return async (_ctx: CommandContext, params: PRGenerationParams = {}) => {
    const targetBranch = params.targetBranch ?? "main";

    const contextResult = await gatherPRContext(gitProvider, targetBranch);
    if (contextResult.kind === "err") return contextResult;
    const prContext = contextResult.value;

    if (prContext.changes.length === 0) {
      return failure({
        code: "NO_CHANGES",
        message: "No changes to generate PR for",
        context: "git.generatePR",
      });
    }

    const proseResult = await generateProseFn({
      domain: "git",
      systemPrompt: PR_GENERATION_PROMPT,
      data: {
        branch: prContext.branch,
        targetBranch: prContext.targetBranch,
        commits: prContext.commits,
        changes: prContext.changes,
        diff: prContext.diff,
      },
    });

    if (proseResult.kind === "err") return proseResult;

    const text = proseResult.value;
    const lines = text.split("\n");
    const titleLine = lines.find(l => l.startsWith("# ")) ?? lines[0] ?? prContext.branch;
    const title = titleLine.replace(/^#\s*/, "").trim();
    const body = text;

    logger.info(`PR description generated for ${prContext.branch}`, "git.generatePR");
    return success({ title, body, branch: prContext.branch });
  };
}

// ============================================================================
// PR Review
// ============================================================================

const PR_REVIEW_PROMPT = `You are a senior code reviewer. Given a branch's commits, changed files, and diff, produce a structured review.

Output format (JSON):
{
  "summary": "<1-2 sentence overall assessment>",
  "verdict": "approve" | "request-changes" | "comment",
  "comments": [
    { "file": "<path>", "severity": "critical" | "suggestion" | "nit", "comment": "<specific feedback>" }
  ]
}

Guidelines:
- Flag bugs, security issues, and missing error handling as critical
- Suggest improvements for readability and maintainability as suggestion
- Style and naming issues are nit
- Be specific — reference exact patterns, not vague advice
- Return valid JSON only, no markdown fences`;

export function createReviewPRHandler(
  gitProvider: GitProvider,
  logger: Logger,
  generateProseFn: GenerateProseFn
): Handler<PRReviewParams, GeneratedPRReview> {
  return async (_ctx: CommandContext, params: PRReviewParams = {}) => {
    const contextResult = await gatherPRContext(gitProvider, params.targetBranch ?? "main");
    if (contextResult.kind === "err") return contextResult;
    const ctx = contextResult.value;

    if (ctx.changes.length === 0) {
      return failure({ code: "NO_CHANGES", message: "No changes to review", context: "git.reviewPR" });
    }

    const proseResult = await generateProseFn({
      domain: "git",
      systemPrompt: PR_REVIEW_PROMPT,
      data: { branch: ctx.branch, targetBranch: ctx.targetBranch, commits: ctx.commits, changes: ctx.changes, diff: ctx.diff },
    });
    if (proseResult.kind === "err") return proseResult;

    try {
      const parsed = JSON.parse(proseResult.value);
      logger.info(`PR review generated for ${ctx.branch}: ${parsed.verdict}`, "git.reviewPR");
      return success({
        branch: ctx.branch,
        summary: parsed.summary ?? "",
        comments: Array.isArray(parsed.comments) ? parsed.comments : [],
        verdict: parsed.verdict ?? "comment",
      });
    } catch {
      // Fallback: treat raw text as summary
      logger.info(`PR review generated for ${ctx.branch} (text fallback)`, "git.reviewPR");
      return success({ branch: ctx.branch, summary: proseResult.value, comments: [], verdict: "comment" as const });
    }
  };
}

// ============================================================================
// PR Comments
// ============================================================================

const PR_COMMENT_PROMPT = `You are a code reviewer generating inline comments. Given changed files and a diff, produce file-level comments.

Output format (JSON):
{
  "comments": [
    { "file": "<path>", "line": <number or null>, "comment": "<specific, actionable feedback>" }
  ]
}

Guidelines:
- Focus on logic errors, edge cases, and missing validation
- Reference specific code patterns from the diff
- One comment per issue, not per file
- Return valid JSON only, no markdown fences`;

export function createCommentPRHandler(
  gitProvider: GitProvider,
  logger: Logger,
  generateProseFn: GenerateProseFn
): Handler<PRCommentParams, GeneratedPRComments> {
  return async (_ctx: CommandContext, params: PRCommentParams = {}) => {
    const contextResult = await gatherPRContext(gitProvider, params.targetBranch ?? "main");
    if (contextResult.kind === "err") return contextResult;
    const ctx = contextResult.value;

    if (ctx.changes.length === 0) {
      return failure({ code: "NO_CHANGES", message: "No changes to comment on", context: "git.commentPR" });
    }

    // Optional path filter
    const data: Record<string, unknown> = {
      branch: ctx.branch, commits: ctx.commits, changes: ctx.changes, diff: ctx.diff,
    };
    if (params.paths?.length) {
      data.filterPaths = params.paths;
    }

    const proseResult = await generateProseFn({ domain: "git", systemPrompt: PR_COMMENT_PROMPT, data });
    if (proseResult.kind === "err") return proseResult;

    try {
      const parsed = JSON.parse(proseResult.value);
      const comments = Array.isArray(parsed.comments) ? parsed.comments : [];
      logger.info(`${comments.length} inline comment(s) generated for ${ctx.branch}`, "git.commentPR");
      return success({ branch: ctx.branch, comments });
    } catch {
      logger.info(`PR comments generated for ${ctx.branch} (text fallback)`, "git.commentPR");
      return success({ branch: ctx.branch, comments: [{ file: "(general)", comment: proseResult.value }] });
    }
  };
}

// ============================================================================
// Conflict Resolution Prose
// ============================================================================

const CONFLICT_RESOLUTION_PROMPT = `You are a git conflict resolution assistant. Given inbound changes with conflicts, file diffs, and severity scores, suggest resolution strategies.

Output format (JSON):
{
  "overview": "<1-2 sentence situation summary>",
  "perFile": [
    {
      "path": "<file path>",
      "strategy": "keep-ours" | "keep-theirs" | "manual-merge" | "review-needed",
      "rationale": "<why this strategy>",
      "suggestedSteps": ["<step 1>", "<step 2>"]
    }
  ]
}

Guidelines:
- Choose keep-ours/keep-theirs only when one side's changes clearly subsume the other
- Default to manual-merge for complex overlapping logic changes
- Use review-needed when you lack sufficient context
- Be concrete in suggested steps
- Return valid JSON only, no markdown fences`;

export function createResolveConflictsHandler(
  gitProvider: GitProvider,
  logger: Logger,
  inboundAnalyzer: InboundAnalyzer,
  generateProseFn: GenerateProseFn
): Handler<Record<string, never>, ConflictResolutionProse> {
  return async (_ctx: CommandContext) => {
    const analysisResult = await inboundAnalyzer.analyze();
    if (analysisResult.kind === "err") return analysisResult;
    const analysis = analysisResult.value;

    if (analysis.conflicts.length === 0) {
      return failure({ code: "NO_CHANGES", message: "No conflicts to resolve", context: "git.resolveConflicts" });
    }

    // Gather per-conflict diffs for richer context
    const conflictDiffs: Record<string, string> = {};
    for (const conflict of analysis.conflicts) {
      const diffResult = await gitProvider.diff(`HEAD..origin/${analysis.branch}`, ["--", conflict.path]);
      if (diffResult.kind === "ok") {
        conflictDiffs[conflict.path] = diffResult.value;
      }
    }

    const proseResult = await generateProseFn({
      domain: "git",
      systemPrompt: CONFLICT_RESOLUTION_PROMPT,
      data: {
        branch: analysis.branch,
        totalInbound: analysis.totalInbound,
        totalLocal: analysis.totalLocal,
        conflicts: analysis.conflicts,
        conflictDiffs,
        summary: analysis.summary,
      },
    });
    if (proseResult.kind === "err") return proseResult;

    try {
      const parsed = JSON.parse(proseResult.value);
      logger.info(`Conflict resolution for ${parsed.perFile?.length ?? 0} file(s)`, "git.resolveConflicts");
      return success({
        overview: parsed.overview ?? "",
        perFile: Array.isArray(parsed.perFile) ? parsed.perFile : [],
      });
    } catch {
      logger.info(`Conflict resolution generated (text fallback)`, "git.resolveConflicts");
      return success({ overview: proseResult.value, perFile: [] });
    }
  };
}
