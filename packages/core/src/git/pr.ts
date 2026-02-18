import { execGit, execGitStrict } from './executor.js';
import { fetchRemote } from './branch.js';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Default remote name */
const DEFAULT_REMOTE = 'origin';

/** Default timeout for fetch operations */
const FETCH_TIMEOUT_MS = 60_000;

/** Default target branches to check for PRs */
const DEFAULT_TARGET_BRANCHES = ['main', 'develop', 'test'];

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PullRequestInfo {
  /** Branch name (e.g. 'feature/new-feature') */
  branch: string;
  /** Remote branch ref (e.g. 'origin/feature/new-feature') */
  remoteRef: string;
  /** Target branch this PR targets (e.g. 'main') */
  targetBranch: string;
  /** Number of commits ahead of target */
  commitsAhead: number;
  /** Number of commits behind target */
  commitsBehind: number;
}

// ─── PR Detection ───────────────────────────────────────────────────────────

/**
 * Check if a branch exists on the remote.
 *
 * @param cwd - Repository working directory
 * @param branchName - Branch name to check
 * @param remote - Remote name (defaults to 'origin')
 * @returns True if the branch exists on remote
 */
export async function remoteBranchExists(
  cwd: string,
  branchName: string,
  remote: string = DEFAULT_REMOTE,
): Promise<boolean> {
  const result = await execGit({
    cwd,
    args: ['ls-remote', '--heads', remote, branchName],
  });

  return result.exitCode === 0 && result.stdout.trim().length > 0;
}

/**
 * Get all remote branches that have been updated recently (have commits not in local).
 *
 * @param cwd - Repository working directory
 * @param targetBranches - Branches to check for incoming PRs (defaults to main, develop, test)
 * @param remote - Remote name (defaults to 'origin')
 * @returns Array of branch names that have new commits
 */
export async function getUpdatedRemoteBranches(
  cwd: string,
  targetBranches: string[] = DEFAULT_TARGET_BRANCHES,
  remote: string = DEFAULT_REMOTE,
): Promise<string[]> {
  // Fetch latest from remote
  await fetchRemote(cwd, remote);

  const updatedBranches: string[] = [];

  for (const branch of targetBranches) {
    const remoteRef = `${remote}/${branch}`;
    const result = await execGit({
      cwd,
      args: ['rev-list', '--count', `HEAD..${remoteRef}`],
    });

    if (result.exitCode === 0) {
      const count = parseInt(result.stdout.trim(), 10);
      if (!isNaN(count) && count > 0) {
        updatedBranches.push(branch);
      }
    }
  }

  return updatedBranches;
}

/**
 * Checkout a remote branch locally.
 *
 * @param cwd - Repository working directory
 * @param branchName - Branch name to checkout
 * @param remote - Remote name (defaults to 'origin')
 * @param createLocal - Whether to create a local tracking branch (defaults to true)
 */
export async function checkoutRemoteBranch(
  cwd: string,
  branchName: string,
  remote: string = DEFAULT_REMOTE,
  createLocal: boolean = true,
): Promise<void> {
  const remoteRef = `${remote}/${branchName}`;

  if (createLocal) {
    // Create local branch tracking remote
    await execGitStrict({
      cwd,
      args: ['checkout', '-b', branchName, remoteRef],
      timeout: FETCH_TIMEOUT_MS,
    });
  } else {
    // Checkout directly (detached HEAD)
    await execGitStrict({
      cwd,
      args: ['checkout', remoteRef],
      timeout: FETCH_TIMEOUT_MS,
    });
  }
}

/**
 * Get information about a potential PR branch.
 * Checks if the branch exists on remote and compares it to target branches.
 *
 * @param cwd - Repository working directory
 * @param branchName - Branch name to check
 * @param targetBranches - Target branches to compare against
 * @param remote - Remote name (defaults to 'origin')
 * @returns PR info if branch exists and has commits, null otherwise
 */
export async function getPullRequestInfo(
  cwd: string,
  branchName: string,
  targetBranches: string[] = DEFAULT_TARGET_BRANCHES,
  remote: string = DEFAULT_REMOTE,
): Promise<PullRequestInfo | null> {
  const remoteRef = `${remote}/${branchName}`;

  // Check if branch exists on remote
  if (!(await remoteBranchExists(cwd, branchName, remote))) {
    return null;
  }

  // Fetch to ensure we have latest
  await fetchRemote(cwd, remote);

  // Find which target branch this PR likely targets (the one with most divergence)
  let bestTarget: string | null = null;
  let maxAhead = 0;

  for (const target of targetBranches) {
    const targetRef = `${remote}/${target}`;
  const aheadResult = await execGit({
    cwd,
    args: ['rev-list', '--count', `${targetRef}..${remoteRef}`],
  });

  if (aheadResult.exitCode === 0) {
    const ahead = parseInt(aheadResult.stdout.trim(), 10);

    if (!isNaN(ahead) && ahead > maxAhead) {
      maxAhead = ahead;
      bestTarget = target;
    }
  }
  }

  if (!bestTarget) {
    return null;
  }

  const targetRef = `${remote}/${bestTarget}`;
  const aheadResult = await execGit({
    cwd,
    args: ['rev-list', '--count', `${targetRef}..${remoteRef}`],
  });
  const behindResult = await execGit({
    cwd,
    args: ['rev-list', '--count', `${remoteRef}..${targetRef}`],
  });

  const ahead = aheadResult.exitCode === 0 ? parseInt(aheadResult.stdout.trim(), 10) : 0;
  const behind = behindResult.exitCode === 0 ? parseInt(behindResult.stdout.trim(), 10) : 0;

  if (isNaN(ahead) || isNaN(behind) || ahead === 0) {
    return null;
  }

  return {
    branch: branchName,
    remoteRef,
    targetBranch: bestTarget,
    commitsAhead: ahead,
    commitsBehind: behind,
  };
}

/**
 * List all remote branches that might be PRs (branches that have commits ahead of target branches).
 *
 * @param cwd - Repository working directory
 * @param targetBranches - Target branches to check against
 * @param remote - Remote name (defaults to 'origin')
 * @returns Array of PR info objects
 */
export async function listPotentialPullRequests(
  cwd: string,
  targetBranches: string[] = DEFAULT_TARGET_BRANCHES,
  remote: string = DEFAULT_REMOTE,
): Promise<PullRequestInfo[]> {
  await fetchRemote(cwd, remote);

  // Get all remote branches
  const result = await execGit({
    cwd,
    args: ['branch', '-r', '--format=%(refname:short)'],
  });

  if (result.exitCode !== 0 || !result.stdout.trim()) {
    return [];
  }

  const remoteBranches = result.stdout
    .trim()
    .split('\n')
    .map((b) => b.trim())
    .filter((b) => b.startsWith(`${remote}/`) && !b.includes('HEAD'))
    .map((b) => b.replace(`${remote}/`, ''))
    .filter((b) => !targetBranches.includes(b)); // Exclude target branches themselves

  const prs: PullRequestInfo[] = [];

  for (const branch of remoteBranches) {
    const prInfo = await getPullRequestInfo(cwd, branch, targetBranches, remote);
    if (prInfo) {
      prs.push(prInfo);
    }
  }

  return prs;
}
