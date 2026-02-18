import type {
  ToolId,
  ScanOptions,
  Finding,
  IModelProvider,
  TldrSummary,
  TldrHighlight,
} from '../../types/index.js';
import { BaseTool } from '../base-tool.js';
import { getRepoRoot } from '../../git/executor.js';
import { getCurrentBranch } from '../../git/branch.js';
import {
  stashChanges,
  hasUncommittedChanges,
  popStash,
} from '../../git/stash.js';
import {
  listPotentialPullRequests,
  checkoutRemoteBranch,
  getPullRequestInfo,
  type PullRequestInfo,
} from '../../git/pr.js';
import type { GitLogEntry } from '../../git/log.js';
import {
  TOOL_MAX_COMMITS_FOR_PROMPT,
} from '../../settings/defaults.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_COMMITS_FOR_PROMPT = TOOL_MAX_COMMITS_FOR_PROMPT;

/** Default target branches to check for PRs */
const DEFAULT_TARGET_BRANCHES = ['main', 'develop', 'test'];

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Dependencies injected into the PRReviewTool.
 */
export interface PRReviewToolDeps {
  /** Model provider for generating summaries */
  modelProvider: IModelProvider;
  /** Working directory */
  cwd: string;
}

// ─── Implementation ─────────────────────────────────────────────────────────

/**
 * PR Review tool — automatically pull and review pull requests.
 *
 * Flow:
 * 1. Check for PRs on target branches (main, develop, test)
 * 2. If PR found, stash current changes
 * 3. Checkout the PR branch
 * 4. Analyze changes using model (diff + commit log)
 * 5. Generate TLDR summary
 * 6. Optionally restore original branch and pop stash
 */
export class PRReviewTool extends BaseTool {
  readonly id: ToolId = 'pr-review';
  readonly name = 'PR Review';
  readonly description = 'Pull and review pull requests on target branches. Stashes changes, checks out PR, and generates a TLDR summary.';

  private deps: PRReviewToolDeps | undefined;

  setDeps(deps: PRReviewToolDeps): void {
    this.deps = deps;
  }

  protected async run(options: ScanOptions): Promise<Finding[]> {
    if (!this.deps) {
      throw new Error('PRReviewTool: Dependencies not set. Call setDeps() before execute().');
    }

    const { modelProvider, cwd } = this.deps;
    const findings: Finding[] = [];

    const repoRoot = await getRepoRoot(cwd);
    const targetBranches = (options.args?.targetBranches as string[] | undefined) ?? DEFAULT_TARGET_BRANCHES;
    const branchName = options.args?.branchName as string | undefined;
    const restoreOriginal = (options.args?.restoreOriginal as boolean | undefined) ?? true;

    // Track state for cleanup
    let originalBranch: string | null = null;
    let stashRef: string | null = null;
    let prInfo: PullRequestInfo | null = null;

    try {
      // Phase 1: Get original branch
      this.throwIfCancelled(options);
      originalBranch = await getCurrentBranch(repoRoot);

      // Phase 2: Check for PRs
      this.throwIfCancelled(options);
      if (branchName) {
        // Specific branch requested
        prInfo = await getPullRequestInfo(repoRoot, branchName, targetBranches);
        if (!prInfo) {
          findings.push(
            this.createFinding({
              title: 'PR not found',
              description: `Branch "${branchName}" does not exist on remote or has no commits ahead of target branches.`,
              location: { filePath: repoRoot, startLine: 0, endLine: 0 },
              severity: 'info',
            }),
          );
          return findings;
        }
      } else {
        // Find first available PR
        const prs = await listPotentialPullRequests(repoRoot, targetBranches);
        if (prs.length === 0) {
          findings.push(
            this.createFinding({
              title: 'No PRs found',
              description: `No pull requests found on target branches: ${targetBranches.join(', ')}.`,
              location: { filePath: repoRoot, startLine: 0, endLine: 0 },
              severity: 'info',
            }),
          );
          return findings;
        }
        // Use the first PR (most recent by default)
        prInfo = prs[0];
      }

      if (!prInfo) {
        return findings;
      }

      // Phase 3: Stash current changes if any
      this.throwIfCancelled(options);
      if (await hasUncommittedChanges(repoRoot)) {
        stashRef = await stashChanges(repoRoot, `AIDev PR Review: ${prInfo.branch}`);
      }

      // Phase 4: Checkout PR branch
      this.throwIfCancelled(options);
      await checkoutRemoteBranch(repoRoot, prInfo.branch, undefined, true);

      // Phase 5: Get diff and commit log
      this.throwIfCancelled(options);
      const targetRef = `origin/${prInfo.targetBranch}`;
      
      // Import execGit once at the top of this scope
      const { execGit } = await import('../../git/executor.js');
      
      // Get diff between PR branch and target branch
      const diffResult = await execGit({
        cwd: repoRoot,
        args: ['diff', `${targetRef}..HEAD`],
      });
      const diff = diffResult.exitCode === 0 ? diffResult.stdout : '';
      
      // Get commits in PR (commits in PR branch but not in target branch)
      // Use git log with range to get commits that are in HEAD but not in targetRef
      const logResult = await execGit({
        cwd: repoRoot,
        args: [
          'log',
          `--format=%H${String.fromCharCode(0x1f)}%an${String.fromCharCode(0x1f)}%ae${String.fromCharCode(0x1f)}%at${String.fromCharCode(0x1f)}%s${String.fromCharCode(0x1e)}`,
          `-n`, String(MAX_COMMITS_FOR_PROMPT),
          `${targetRef}..HEAD`,
        ],
      });

      let prCommits: GitLogEntry[] = [];
      if (logResult.exitCode === 0 && logResult.stdout.trim()) {
        const { parseLogOutput } = await import('../../git/log.js');
        prCommits = parseLogOutput(logResult.stdout, false);
        
        // Also get file lists for each commit
        for (const commit of prCommits) {
          const filesResult = await execGit({
            cwd: repoRoot,
            args: ['diff-tree', '--no-commit-id', '--name-only', '-r', commit.hash],
          });
          if (filesResult.exitCode === 0) {
            commit.files = filesResult.stdout.trim().split('\n').filter((f) => f.length > 0);
          }
        }
      }

      // Phase 6: Generate review summary using model
      this.throwIfCancelled(options);
      const prompt = buildPRReviewPrompt(prInfo, diff, prCommits);

      let response;
      try {
        response = await this.sendRequestWithTimeout(
          async (timeoutSignal) => {
            const mergedSignal = options.signal
              ? AbortSignal.any([options.signal, timeoutSignal])
              : timeoutSignal;
            
            return modelProvider.sendRequest({
              role: 'chat',
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt },
              ],
              signal: mergedSignal,
            });
          },
        );
      } catch (error) {
        findings.push(
          this.createErrorFinding(repoRoot, error, 'PR review generation'),
        );
        return findings;
      }

      // Phase 7: Parse model response
      this.throwIfCancelled(options);
      const summary = parsePRReviewResponse(response.content, prInfo, prCommits);

      // Store summary as finding
      findings.push(
        this.createFinding({
          title: `PR Review: ${prInfo.branch} → ${prInfo.targetBranch}`,
          description: summary.summary,
          location: { filePath: repoRoot, startLine: 0, endLine: 0 },
          severity: 'info',
          metadata: {
            summary,
            prInfo,
            commitCount: prCommits.length,
            stashRef,
            originalBranch,
          },
        }),
      );

      // Phase 8: Restore original branch if requested
      if (restoreOriginal && originalBranch && originalBranch !== prInfo.branch) {
        this.throwIfCancelled(options);
        // Checkout original branch
        const { execGitStrict } = await import('../../git/executor.js');
        await execGitStrict({
          cwd: repoRoot,
          args: ['checkout', originalBranch],
        });

        // Pop stash if we stashed
        if (stashRef) {
          try {
            await popStash(repoRoot);
          } catch (error) {
            // Stash pop might fail if there are conflicts - that's okay
            findings.push(
              this.createFinding({
                title: 'Stash restore warning',
                description: `Could not restore stashed changes: ${error instanceof Error ? error.message : String(error)}. Use 'git stash list' to see your stashes.`,
                location: { filePath: repoRoot, startLine: 0, endLine: 0 },
                severity: 'warning',
              }),
            );
          }
        }
      } else {
        // Add info about current state
        findings.push(
          this.createFinding({
            title: 'Branch checkout complete',
            description: `Checked out branch "${prInfo.branch}". ${stashRef ? `Your changes were stashed (${stashRef}).` : ''}`,
            location: { filePath: repoRoot, startLine: 0, endLine: 0 },
            severity: 'info',
          }),
        );
      }

      return findings;
    } catch (error) {
      // Cleanup on error
      if (originalBranch && restoreOriginal) {
        try {
          const { execGitStrict } = await import('../../git/executor.js');
          await execGitStrict({
            cwd: repoRoot,
            args: ['checkout', originalBranch],
          });
          if (stashRef) {
            await popStash(repoRoot);
          }
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }

      findings.push(
        this.createErrorFinding(repoRoot, error, 'PR review'),
      );
      return findings;
    }
  }

  protected countScannedFiles(_options: ScanOptions): number {
    // PR review doesn't scan files in the traditional sense
    return 0;
  }
}

// ─── Prompt Construction ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a pull request reviewer. Given a PR's diff and commit history, provide a clear, concise review summary.

Rules:
- Start with a 1-2 sentence high-level summary of what the PR does
- Then list 3-7 key highlights, each on its own line prefixed with "- "
- Each highlight should describe WHAT changed and WHY (infer intent from commits)
- Note any potential issues, risks, or areas that need attention
- Group related changes together rather than listing every commit
- Use present tense ("Adds authentication", "Fixes layout bug")
- Keep it brief — this is a TLDR review, not a detailed code review`;

function buildPRReviewPrompt(
  prInfo: PullRequestInfo,
  diff: string,
  commits: GitLogEntry[],
): string {
  const parts: string[] = [];

  parts.push(`Review this pull request:`);
  parts.push(`**Branch**: ${prInfo.branch} → ${prInfo.targetBranch}`);
  parts.push(`**Commits ahead**: ${String(prInfo.commitsAhead)}`);
  parts.push(`**Commits behind**: ${String(prInfo.commitsBehind)}`);
  parts.push('');

  if (commits.length > 0) {
    parts.push('## Commits');
    parts.push('');
    for (const commit of commits.slice(0, MAX_COMMITS_FOR_PROMPT)) {
      const date = commit.timestamp.toISOString().split('T')[0];
      const files = commit.files && commit.files.length > 0 ? ` [${commit.files.join(', ')}]` : '';
      parts.push(`- ${date} | ${commit.subject}${files}`);
    }
    parts.push('');
  }

  if (diff) {
    parts.push('## Diff Summary');
    parts.push('');
    // Limit diff size to avoid token limits
    const diffLines = diff.split('\n');
    const maxDiffLines = 500;
    const truncatedDiff = diffLines.length > maxDiffLines
      ? diffLines.slice(0, maxDiffLines).join('\n') + `\n\n... (${String(diffLines.length - maxDiffLines)} more lines)`
      : diff;
    parts.push('```diff');
    parts.push(truncatedDiff);
    parts.push('```');
  }

  return parts.join('\n');
}

// ─── Response Parsing ───────────────────────────────────────────────────────

function parsePRReviewResponse(
  content: string,
  prInfo: PullRequestInfo,
  commits: GitLogEntry[],
): TldrSummary {
  const lines = content.trim().split('\n');

  // First non-empty lines before bullet points = summary
  const summaryLines: string[] = [];
  const highlightLines: string[] = [];
  let inHighlights = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      inHighlights = true;
      highlightLines.push(trimmed.slice(2).trim());
    } else if (!inHighlights && trimmed.length > 0) {
      summaryLines.push(trimmed);
    }
  }

  // Collect all files mentioned across commits
  const allFiles = new Set<string>();
  const allCommits = new Set<string>();
  for (const entry of commits) {
    allCommits.add(entry.hash);
    if (entry.files) {
      for (const f of entry.files) allFiles.add(f);
    }
  }

  const highlights: TldrHighlight[] = highlightLines.map((desc) => ({
    description: desc,
    files: [], // Could be enriched by matching file names in the description
    commits: [],
  }));

  return {
    scope: `${prInfo.branch} → ${prInfo.targetBranch}`,
    since: commits.length > 0 ? commits[commits.length - 1].timestamp : new Date(),
    until: commits.length > 0 ? commits[0].timestamp : new Date(),
    commitCount: commits.length,
    summary: summaryLines.join(' ') || content.trim(),
    highlights,
  };
}
