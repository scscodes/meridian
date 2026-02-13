import { execGit, execGitStrict } from './executor.js';
import type { GitLogEntry } from './log.js';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Default remote name */
const DEFAULT_REMOTE = 'origin';

/** Default timeout for fetch operations (ms) — longer than typical commands */
const FETCH_TIMEOUT_MS = 60_000;

/** Max commits to include in branch comparison logs */
const MAX_COMPARISON_COMMITS = 50;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AheadBehind {
  ahead: number;
  behind: number;
}

export interface LastCommitInfo {
  hash: string;
  subject: string;
  body: string;
}

// ─── Branch Info ────────────────────────────────────────────────────────────

/**
 * Get the current branch name.
 *
 * Returns 'HEAD' if in detached HEAD state.
 */
export async function getCurrentBranch(cwd: string): Promise<string> {
  const output = await execGitStrict({
    cwd,
    args: ['rev-parse', '--abbrev-ref', 'HEAD'],
  });
  return output.trim();
}

/**
 * Get the remote tracking branch for the current branch.
 *
 * @returns Tracking branch ref (e.g. 'origin/main') or null if no upstream is set.
 */
export async function getTrackingBranch(cwd: string): Promise<string | null> {
  const result = await execGit({
    cwd,
    args: ['rev-parse', '--abbrev-ref', '@{upstream}'],
  });

  if (result.exitCode !== 0) {
    // No upstream configured
    return null;
  }

  return result.stdout.trim();
}

/**
 * Get how many commits the local branch is ahead/behind its upstream.
 *
 * @returns `{ ahead, behind }` counts, or null if no upstream is set.
 */
export async function getAheadBehind(cwd: string): Promise<AheadBehind | null> {
  const result = await execGit({
    cwd,
    args: ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'],
  });

  if (result.exitCode !== 0) {
    return null;
  }

  const parts = result.stdout.trim().split(/\s+/);
  if (parts.length < 2) return null;

  const ahead = parseInt(parts[0], 10);
  const behind = parseInt(parts[1], 10);

  if (isNaN(ahead) || isNaN(behind)) return null;

  return { ahead, behind };
}

// ─── Remote Operations ──────────────────────────────────────────────────────

/**
 * Fetch latest state from a remote.
 *
 * @param cwd - Repository working directory
 * @param remote - Remote name (defaults to 'origin')
 */
export async function fetchRemote(cwd: string, remote?: string): Promise<void> {
  await execGitStrict({
    cwd,
    args: ['fetch', remote ?? DEFAULT_REMOTE],
    timeout: FETCH_TIMEOUT_MS,
  });
}

/**
 * Get the diff between HEAD and the upstream tracking branch.
 *
 * Uses three-dot diff (`HEAD...@{upstream}`) to show changes since divergence.
 *
 * @returns Full diff text, or empty string if no upstream or no diff.
 */
export async function getRemoteDiff(cwd: string): Promise<string> {
  const result = await execGit({
    cwd,
    args: ['diff', 'HEAD...@{upstream}'],
  });

  if (result.exitCode !== 0) {
    return '';
  }

  return result.stdout;
}

/**
 * Get the diff summary (stat) between HEAD and upstream.
 *
 * @returns Diff stat text, or empty string if no upstream.
 */
export async function getRemoteDiffSummary(cwd: string): Promise<string> {
  const result = await execGit({
    cwd,
    args: ['diff', '--stat', 'HEAD...@{upstream}'],
  });

  if (result.exitCode !== 0) {
    return '';
  }

  return result.stdout;
}

/**
 * Get commits that exist on remote but not locally (incoming),
 * or commits that exist locally but not on remote (outgoing).
 *
 * @param cwd - Repository working directory
 * @param direction - 'incoming' for remote→local, 'outgoing' for local→remote
 * @returns Parsed log entries, or empty array if no upstream.
 */
export async function getRemoteLog(
  cwd: string,
  direction: 'incoming' | 'outgoing',
): Promise<GitLogEntry[]> {
  const tracking = await getTrackingBranch(cwd);
  if (!tracking) return [];

  // incoming: commits on upstream not in HEAD
  // outgoing: commits in HEAD not on upstream
  const range =
    direction === 'incoming'
      ? `HEAD..${tracking}`
      : `${tracking}..HEAD`;

  return getLogForRange(cwd, range);
}

/**
 * Get log entries for a given revision range (e.g. 'HEAD..origin/main').
 * Uses raw git log rather than the getLog() helper which doesn't support range specs.
 */
async function getLogForRange(cwd: string, range: string): Promise<GitLogEntry[]> {
  const result = await execGit({
    cwd,
    args: [
      'log',
      '--format=%H%n%an%n%ae%n%at%n%s%n---END---',
      `-n`, String(MAX_COMPARISON_COMMITS),
      range,
    ],
  });

  if (result.exitCode !== 0 || !result.stdout.trim()) {
    return [];
  }

  return parseRangeLogOutput(result.stdout);
}

/** Number of fields per commit record in range log output */
const RANGE_LOG_FIELD_COUNT = 5;

/**
 * Parse the custom range log format into GitLogEntry[].
 */
function parseRangeLogOutput(output: string): GitLogEntry[] {
  const records = output.split('---END---\n').filter((r) => r.trim().length > 0);
  const entries: GitLogEntry[] = [];

  for (const record of records) {
    const lines = record.trim().split('\n');
    if (lines.length < RANGE_LOG_FIELD_COUNT) continue;

    const [hash, authorName, authorEmail, timestampStr, subject] = lines;
    const timestampSeconds = parseInt(timestampStr, 10);
    if (isNaN(timestampSeconds)) continue;

    entries.push({
      hash,
      authorName,
      authorEmail,
      timestamp: new Date(timestampSeconds * 1000),
      subject,
    });
  }

  return entries;
}
