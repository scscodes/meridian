/**
 * Git Domain Handlers — one example per operation pattern.
 * Includes enhanced smartCommit with change grouping and batch commits.
 */

import {
  Handler,
  CommandContext,
  Result,
  success,
  failure,
  GitStatus,
  Logger,
  GitProvider,
  GitFileChange,
} from "../../types";
import {
  FileChange,
  ChangeGroup,
  SmartCommitParams,
  SmartCommitBatchResult,
  InboundChanges,
  ApprovalUI,
  PRGenerationParams,
  GeneratedPR,
  PRContext,
  PRReviewParams,
  GeneratedPRReview,
  PRCommentParams,
  GeneratedPRComments,
  ConflictResolutionProse,
} from "./types";

/** Injected prose generation function — avoids transitive vscode import in tests. */
export type GenerateProseFn = (request: {
  domain: "hygiene" | "git" | "chat";
  systemPrompt: string;
  data: Record<string, unknown>;
}) => Promise<Result<string>>;
import {
  ChangeGrouper,
  CommitMessageSuggester,
  BatchCommitter,
  InboundAnalyzer,
} from "./service";

/**
 * Example: git.status — Read-only operation.
 * Returns current branch and dirty state.
 */
export function createStatusHandler(
  gitProvider: GitProvider,
  logger: Logger
): Handler<any, GitStatus> {
  return async (_ctx: CommandContext, params: any = {}) => {
    // Validate branch parameter shape when provided
    if (params.branch !== undefined && typeof params.branch !== "string") {
      return failure({
        code: "INVALID_PARAMS",
        message: "Branch must be a string when provided",
        context: "git.status",
      });
    }

    try {
      logger.debug(
        `Getting git status for branch: ${params.branch || "current"}`,
        "GitStatusHandler"
      );

      const result = await gitProvider.status(params.branch);
      if (result.kind === "ok") {
        return success(result.value);
      }
      return result;
    } catch (err) {
      return failure({
        code: "GIT_STATUS_ERROR",
        message: "Failed to fetch git status",
        details: err,
        context: "git.status",
      });
    }
  };
}

/**
 * Example: git.pull — Mutation operation.
 * Demonstrates error handling for conflicts, network issues.
 */
export function createPullHandler(
  gitProvider: GitProvider,
  logger: Logger
): Handler<any, void> {
  return async (_ctx: CommandContext, params: any = {}) => {
    // Validate branch parameter shape when provided
    if (params.branch !== undefined && typeof params.branch !== "string") {
      return failure({
        code: "INVALID_PARAMS",
        message: "Branch must be a string when provided",
        context: "git.pull",
      });
    }

    try {
      logger.info(
        `Pulling from git branch: ${params.branch || "current"}`,
        "GitPullHandler"
      );

      const result = await gitProvider.pull(params.branch);
      if (result.kind === "ok") {
        logger.info(
          `Pull successful: ${result.value.message}`,
          "GitPullHandler"
        );
        return success(void 0);
      }
      return result;
    } catch (err) {
      return failure({
        code: "GIT_PULL_ERROR",
        message: "Failed to pull from git",
        details: err,
        context: "git.pull",
      });
    }
  };
}

/**
 * Example: git.commit — Mutation with message parameter.
 * Demonstrates parameter validation.
 */
export function createCommitHandler(
  gitProvider: GitProvider,
  logger: Logger
): Handler<any, void> {
  return async (_ctx: CommandContext, params: any = { message: "" }) => {
    // Validate branch parameter shape when provided
    if (params.branch !== undefined && typeof params.branch !== "string") {
      return failure({
        code: "INVALID_PARAMS",
        message: "Branch must be a string when provided",
        context: "git.commit",
      });
    }

    // Validate required params
    if (!params.message || params.message.trim().length === 0) {
      return failure({
        code: "INVALID_PARAMS",
        message: "Commit message is required and cannot be empty",
        context: "git.commit",
      });
    }

    try {
      logger.info(
        `Committing with message: "${params.message}"`,
        "GitCommitHandler"
      );

      const result = await gitProvider.commit(params.message, params.branch);
      if (result.kind === "ok") {
        logger.info("Commit successful", "GitCommitHandler");
        return success(void 0);
      }
      return result;
    } catch (err) {
      return failure({
        code: "GIT_COMMIT_ERROR",
        message: "Failed to commit to git",
        details: err,
        context: "git.commit",
      });
    }
  };
}

/**
 * Example: git.smartCommit — Interactive staged commit with validation.
 * Demonstrates complex workflow: stage → diff → validate message → commit.
 */
export function createSmartCommitHandler(
  gitProvider: GitProvider,
  logger: Logger,
  changeGrouper: ChangeGrouper,
  messageSuggester: CommitMessageSuggester,
  batchCommitter: BatchCommitter,
  approvalUI?: ApprovalUI
): Handler<SmartCommitParams, SmartCommitBatchResult> {
  return async (
    _ctx: CommandContext,
    params: SmartCommitParams = {}
  ) => {
    const startTime = Date.now();

    try {
      // Validate parameters
      if (
        params.autoApprove !== undefined &&
        typeof params.autoApprove !== "boolean"
      ) {
        return failure({
          code: "INVALID_PARAMS",
          message: "autoApprove must be a boolean when provided",
          context: "git.smartCommit",
        });
      }

      if (params.branch !== undefined && typeof params.branch !== "string") {
        return failure({
          code: "INVALID_PARAMS",
          message: "Branch must be a string when provided",
          context: "git.smartCommit",
        });
      }

      logger.info(
        `Smart commit: analyzing changes for branch ${params.branch || "current"}`,
        "GitSmartCommitHandler"
      );

      // Step 1: Get all changes (staged + unstaged)
      const changesResult = await gitProvider.getAllChanges();
      if (changesResult.kind === "err") {
        return failure({
          code: "GET_CHANGES_FAILED",
          message: "Failed to get git changes",
          details: changesResult.error,
          context: "git.smartCommit",
        });
      }

      if (changesResult.value.length === 0) {
        return failure({
          code: "NO_CHANGES",
          message: "No changes to commit",
          context: "git.smartCommit",
        });
      }

      logger.info(
        `Found ${changesResult.value.length} changed files`,
        "GitSmartCommitHandler"
      );

      // Step 2: Parse changes into FileChange[]
      const fileChanges = parseFileChanges(changesResult.value);
      logger.debug(
        `Parsed ${fileChanges.length} file changes with metadata`,
        "GitSmartCommitHandler"
      );

      // Step 3: Group similar changes
      const groups = changeGrouper.group(fileChanges);
      logger.info(
        `Grouped ${fileChanges.length} files into ${groups.length} groups`,
        "GitSmartCommitHandler"
      );

      // Step 4: Suggest commit messages for each group
      const groupsWithMessages = groups.map((g) => ({
        ...g,
        suggestedMessage: messageSuggester.suggest(g),
      }));

      // Step 5: Present to user for approval (or auto-approve)
      let approvedGroups: ChangeGroup[];

      if (params.autoApprove || !approvalUI) {
        // Programmatic path: skip UI entirely
        approvedGroups = groupsWithMessages;
        logger.info(
          `Auto-approving all ${groupsWithMessages.length} group(s)`,
          "GitSmartCommitHandler"
        );
      } else {
        // Interactive path: show approval UI
        logger.info(
          `Presenting ${groupsWithMessages.length} group(s) for user approval`,
          "GitSmartCommitHandler"
        );

        const approvalResult = await approvalUI(groupsWithMessages);

        // null = user cancelled (Escape)
        if (approvalResult === null) {
          return failure({
            code: "COMMIT_CANCELLED",
            message: "Smart commit cancelled by user",
            context: "git.smartCommit",
          });
        }

        // Patch approved messages back onto groups for BatchCommitter
        approvedGroups = approvalResult.map((item) => ({
          ...item.group,
          suggestedMessage: {
            ...item.group.suggestedMessage,
            full: item.approvedMessage,
          },
        }));
      }

      if (approvedGroups.length === 0) {
        return failure({
          code: "NO_GROUPS_APPROVED",
          message: "No groups approved for commit",
          context: "git.smartCommit",
        });
      }

      // Step 6: Execute batch commits
      const commitResult = await batchCommitter.executeBatch(approvedGroups);
      if (commitResult.kind === "err") {
        return commitResult;
      }

      const duration = Date.now() - startTime;
      const result: SmartCommitBatchResult = {
        commits: commitResult.value,
        totalFiles: fileChanges.length,
        totalGroups: groups.length,
        duration,
      };

      logger.info(
        `Smart commit completed: ${result.commits.length} commits, ${result.totalFiles} files in ${duration}ms`,
        "GitSmartCommitHandler"
      );

      return success(result);
    } catch (err) {
      logger.error(
        "Smart commit error",
        "GitSmartCommitHandler",
        {
          code: "SMART_COMMIT_ERROR",
          message: "Unexpected error during smart commit",
          details: err,
        }
      );

      return failure({
        code: "SMART_COMMIT_ERROR",
        message: "Failed to execute smart commit",
        details: err,
        context: "git.smartCommit",
      });
    }
  };
}

/**
 * Example: git.analyzeInbound — Analyze remote changes without pulling.
 * Detects conflicts between local and remote modifications.
 */
export function createAnalyzeInboundHandler(
  inboundAnalyzer: InboundAnalyzer,
  logger: Logger
): Handler<any, InboundChanges> {
  return async (_ctx: CommandContext, _params: any = {}) => {
    try {
      logger.info("Analyzing inbound changes from remote", "GitAnalyzeInboundHandler");

      const result = await inboundAnalyzer.analyze();
      
      if (result.kind === "err") {
        logger.error(
          "Failed to analyze inbound changes",
          "GitAnalyzeInboundHandler",
          result.error
        );
        return result;
      }

      const analysis = result.value;
      logger.info(
        `Inbound analysis complete: ${analysis.totalInbound} remote changes, ${analysis.conflicts.length} conflicts`,
        "GitAnalyzeInboundHandler"
      );

      return success(analysis);
    } catch (err) {
      logger.error(
        "Unexpected error during inbound analysis",
        "GitAnalyzeInboundHandler",
        {
          code: "INBOUND_ANALYSIS_ERROR",
          message: "Failed to analyze inbound changes",
          details: err,
        }
      );

      return failure({
        code: "INBOUND_ANALYSIS_ERROR",
        message: "Failed to analyze inbound changes",
        details: err,
        context: "git.analyzeInbound",
      });
    }
  };
}

// ============================================================================
// Shared PR Context Gathering
// ============================================================================

/**
 * Shared context gather for PR-related prose consumers.
 * Used by generatePR, reviewPR, and commentPR handlers.
 */
export async function gatherPRContext(
  gitProvider: GitProvider,
  targetBranch: string = "main"
): Promise<Result<PRContext>> {
  // 1. Get current branch
  const branchResult = await gitProvider.getCurrentBranch();
  if (branchResult.kind === "err") return branchResult;
  const branch = branchResult.value.trim();

  // 2. Get recent commits
  const commitsResult = await gitProvider.getRecentCommits(20);
  if (commitsResult.kind === "err") return commitsResult;

  // 3. Get file-level change stats (staged + unstaged)
  const changesResult = await gitProvider.getAllChanges();
  if (changesResult.kind === "err") return changesResult;

  // 4. Get raw diff for context (non-fatal if fails)
  const diffResult = await gitProvider.getDiff();

  return success({
    branch,
    targetBranch,
    commits: commitsResult.value,
    changes: changesResult.value,
    diff: diffResult.kind === "ok" ? diffResult.value : "(diff unavailable)",
  });
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

/**
 * Helper: Parse GitFileChange[] into FileChange[] with metadata.
 */
export function parseFileChanges(changes: GitFileChange[]): FileChange[] {
  const getFileType = (path: string): string => {
    const match = path.match(/\.([a-z]+)$/i);
    return match ? `.${match[1]}` : "";
  };

  const extractDomain = (path: string): string => {
    const parts = path.split("/");
    if (parts[0] === "src" && parts[1]) {
      if (parts[1] === "domains" && parts[2]) {
        return parts[2];
      }
      if (parts[1] === "infrastructure") {
        return "infrastructure";
      }
    }
    return parts[0] || "root";
  };

  return changes.map((change) => ({
    path: change.path,
    status: change.status,
    domain: extractDomain(change.path),
    fileType: getFileType(change.path),
    additions: change.additions,
    deletions: change.deletions,
  }));
}
