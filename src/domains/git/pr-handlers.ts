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
  GenerateProseFn,
} from "../../types";
import { GIT_ERROR_CODES } from "../../infrastructure/error-codes";
import { GIT_DEFAULTS } from "../../constants";
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
import { getPrompt } from "../../infrastructure/prompt-registry";

/** Re-exported for backward compatibility — canonical definition in src/types.ts */
export type { GenerateProseFn } from "../../types";

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

  // 2. Resolve the true merge-base to avoid including commits from targetBranch
  const mergeBaseResult = await gitProvider.getMergeBase(branch, targetBranch);
  const rangeBase = mergeBaseResult.kind === "ok" ? mergeBaseResult.value : targetBranch;

  // 3. Get commits on this branch since it diverged from targetBranch
  const commitsResult = await gitProvider.getCommitRange(rangeBase, "HEAD");
  if (commitsResult.kind === "err") return commitsResult;

  // 4. Get file-level change stats via numstat diff against merge-base
  const rangeRef = `${rangeBase}...HEAD`;
  const numstatResult = await gitProvider.diff(rangeRef, ["--numstat"]);
  if (numstatResult.kind === "err") return numstatResult;

  const changes = parseNumstatOutput(numstatResult.value);

  if (changes.length === 0) {
    return failure({
      code: GIT_ERROR_CODES.NO_CHANGES,
      message: `No changes between ${targetBranch} and HEAD`,
      context: "gatherPRContext",
    });
  }

  // 5. Get full diff for LLM context (non-fatal if fails, truncated for token safety)
  const diffResult = await gitProvider.diff(rangeRef);
  let diff = diffResult.kind === "ok" ? diffResult.value : "(diff unavailable)";
  if (diff.length > GIT_DEFAULTS.MAX_DIFF_BYTES) {
    diff = diff.slice(0, GIT_DEFAULTS.MAX_DIFF_BYTES) + "\n\n(diff truncated — exceeded size limit)";
  }

  return success({
    branch,
    targetBranch,
    commits: commitsResult.value,
    changes,
    diff,
  });
}

/**
 * Parse `git diff --numstat` output into PRContext-compatible change entries.
 * Each line: `additions\tdeletions\tpath`
 */
export function parseNumstatOutput(
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
    // Derive status from line counts: numstat doesn't carry explicit status codes
    const status: "A" | "M" | "D" =
      additions === 0 && deletions > 0 ? "D" :
      deletions === 0 && additions > 0 ? "A" : "M";
    results.push({ path, status, additions, deletions });
  }
  return results;
}

// ============================================================================
// PR Description Generation
// ============================================================================

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
        code: GIT_ERROR_CODES.NO_CHANGES,
        message: "No changes to generate PR for",
        context: "git.generatePR",
      });
    }

    const proseResult = await generateProseFn({
      domain: "git",
      systemPrompt: getPrompt("PR_GENERATION"),
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
    const titleLine = lines.find(l => l.startsWith("# ")) ?? lines.find(l => l.trim().length > 0) ?? prContext.branch;
    const title = titleLine.replace(/^#\s*/, "").trim();
    const body = text;

    logger.info(`PR description generated for ${prContext.branch}`, "git.generatePR");
    return success({ title, body, branch: prContext.branch });
  };
}

// ============================================================================
// PR Review
// ============================================================================

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
      return failure({ code: GIT_ERROR_CODES.NO_CHANGES, message: "No changes to review", context: "git.reviewPR" });
    }

    const proseResult = await generateProseFn({
      domain: "git",
      systemPrompt: getPrompt("PR_REVIEW"),
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
      logger.warn(
        `PR review JSON parse failed for ${ctx.branch} (${proseResult.value.length} chars), using text fallback`,
        "git.reviewPR"
      );
      return success({ branch: ctx.branch, summary: proseResult.value, comments: [], verdict: "comment" as const, _fallback: true });
    }
  };
}

// ============================================================================
// PR Comments
// ============================================================================

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
      return failure({ code: GIT_ERROR_CODES.NO_CHANGES, message: "No changes to comment on", context: "git.commentPR" });
    }

    // Optional path filter
    const data: Record<string, unknown> = {
      branch: ctx.branch, commits: ctx.commits, changes: ctx.changes, diff: ctx.diff,
    };
    if (params.paths?.length) {
      data.filterPaths = params.paths;
    }

    const proseResult = await generateProseFn({ domain: "git", systemPrompt: getPrompt("PR_COMMENT"), data });
    if (proseResult.kind === "err") return proseResult;

    try {
      const parsed = JSON.parse(proseResult.value);
      const comments = Array.isArray(parsed.comments) ? parsed.comments : [];
      logger.info(`${comments.length} inline comment(s) generated for ${ctx.branch}`, "git.commentPR");
      return success({ branch: ctx.branch, comments });
    } catch {
      logger.warn(
        `PR comments JSON parse failed for ${ctx.branch} (${proseResult.value.length} chars), using text fallback`,
        "git.commentPR"
      );
      return success({ branch: ctx.branch, comments: [{ file: "(general)", comment: proseResult.value }], _fallback: true });
    }
  };
}

// ============================================================================
// Conflict Resolution Prose
// ============================================================================

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
      return failure({ code: GIT_ERROR_CODES.NO_CHANGES, message: "No conflicts to resolve", context: "git.resolveConflicts" });
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
      systemPrompt: getPrompt("CONFLICT_RESOLUTION"),
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
      logger.warn(
        `Conflict resolution JSON parse failed (${proseResult.value.length} chars), using text fallback`,
        "git.resolveConflicts"
      );
      return success({ overview: proseResult.value, perFile: [], _fallback: true });
    }
  };
}
