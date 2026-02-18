import { execGit, execGitStrict } from './executor.js';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Default timeout for stash operations */
const STASH_TIMEOUT_MS = 10_000;

// ─── Stash Operations ───────────────────────────────────────────────────────

/**
 * Stash current changes (including untracked files).
 *
 * @param cwd - Repository working directory
 * @param message - Optional stash message
 * @returns The stash reference (e.g. 'stash@{0}')
 */
export async function stashChanges(cwd: string, message?: string): Promise<string> {
  const args = ['stash', 'push', '-u'];
  if (message) {
    args.push('-m', message);
  }

  await execGitStrict({
    cwd,
    args,
    timeout: STASH_TIMEOUT_MS,
  });

  // Get the stash reference
  const result = await execGit({
    cwd,
    args: ['stash', 'list', '-1', '--format=%gd'],
  });

  return result.stdout.trim() || 'stash@{0}';
}

/**
 * Check if there are any changes to stash.
 *
 * @param cwd - Repository working directory
 * @returns True if there are uncommitted changes
 */
export async function hasUncommittedChanges(cwd: string): Promise<boolean> {
  const result = await execGit({
    cwd,
    args: ['status', '--porcelain'],
  });

  return result.stdout.trim().length > 0;
}

/**
 * Pop the most recent stash entry.
 *
 * @param cwd - Repository working directory
 */
export async function popStash(cwd: string): Promise<void> {
  await execGitStrict({
    cwd,
    args: ['stash', 'pop'],
    timeout: STASH_TIMEOUT_MS,
  });
}

/**
 * List all stash entries.
 *
 * @param cwd - Repository working directory
 * @returns Array of stash references (e.g. ['stash@{0}', 'stash@{1}'])
 */
export async function listStashes(cwd: string): Promise<string[]> {
  const result = await execGit({
    cwd,
    args: ['stash', 'list', '--format=%gd'],
  });

  if (!result.stdout.trim()) {
    return [];
  }

  return result.stdout.trim().split('\n').filter((s) => s.length > 0);
}
