import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { access } from 'node:fs/promises';
import { execGit, execGitStrict } from './executor.js';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Conflict marker prefixes */
const MARKER_OURS = '<<<<<<<';
const MARKER_SEPARATOR = '=======';
const MARKER_THEIRS = '>>>>>>>';

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * A single conflict section within a file.
 */
export interface ConflictHunk {
  /** Line number where the conflict starts (1-based, at <<<<<<< marker) */
  startLine: number;
  /** Line number where the conflict ends (1-based, at >>>>>>> marker) */
  endLine: number;
  /** Content from the current branch (between <<<<<<< and =======) */
  ours: string;
  /** Content from the incoming branch (between ======= and >>>>>>>) */
  theirs: string;
  /** Label from the <<<<<<< marker (branch name / commit ref) */
  oursLabel: string;
  /** Label from the >>>>>>> marker (branch name / commit ref) */
  theirsLabel: string;
}

/**
 * A file with unresolved merge conflicts.
 */
export interface ConflictFile {
  filePath: string;
  hunks: ConflictHunk[];
}

// ─── Merge State Detection ──────────────────────────────────────────────────

/**
 * Check if the repository is in a merge state (has MERGE_HEAD).
 */
export async function isInMergeState(cwd: string): Promise<boolean> {
  try {
    await access(join(cwd, '.git', 'MERGE_HEAD'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the repository is in any conflict state (merge, rebase, cherry-pick).
 */
export async function isInConflictState(cwd: string): Promise<boolean> {
  const mergeHead = isInMergeState(cwd);
  const rebaseDir = access(join(cwd, '.git', 'rebase-merge')).then(
    () => true,
    () => false,
  );
  const rebaseApply = access(join(cwd, '.git', 'rebase-apply')).then(
    () => true,
    () => false,
  );
  const cherryPick = access(join(cwd, '.git', 'CHERRY_PICK_HEAD')).then(
    () => true,
    () => false,
  );

  const results = await Promise.all([mergeHead, rebaseDir, rebaseApply, cherryPick]);
  return results.some(Boolean);
}

// ─── Conflict File Detection ────────────────────────────────────────────────

/**
 * Get paths of files with unresolved merge conflicts.
 *
 * Uses `git diff --name-only --diff-filter=U` to find unmerged entries.
 *
 * @returns Array of file paths with conflicts, or empty array if none.
 */
export async function getConflictFiles(cwd: string): Promise<string[]> {
  const result = await execGit({
    cwd,
    args: ['diff', '--name-only', '--diff-filter=U'],
  });

  if (result.exitCode !== 0 || !result.stdout.trim()) {
    return [];
  }

  return result.stdout
    .trim()
    .split('\n')
    .filter((line) => line.length > 0);
}

// ─── Conflict Marker Parsing ────────────────────────────────────────────────

/**
 * Parse conflict markers from file content into structured hunks.
 *
 * Handles the standard git conflict marker format:
 * ```
 * <<<<<<< ours-label
 * our content
 * =======
 * their content
 * >>>>>>> theirs-label
 * ```
 *
 * @param content - Raw file content with conflict markers
 * @returns Array of parsed conflict hunks
 *
 * @internal Exported for testing.
 */
export function parseConflictMarkers(content: string): ConflictHunk[] {
  const lines = content.split('\n');
  const hunks: ConflictHunk[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith(MARKER_OURS)) {
      const hunk = parseOneHunk(lines, i);
      if (hunk) {
        hunks.push(hunk);
        i = hunk.endLine; // Skip past the >>>>>>> line
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  return hunks;
}

/**
 * Parse a single conflict hunk starting at the <<<<<<< line.
 */
function parseOneHunk(lines: string[], startIndex: number): ConflictHunk | null {
  const oursLabel = lines[startIndex].slice(MARKER_OURS.length).trim();
  const startLine = startIndex + 1; // Convert to 1-based

  const oursLines: string[] = [];
  const theirsLines: string[] = [];
  let separatorFound = false;
  let endLine = startLine;
  let theirsLabel = '';

  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    if (!separatorFound && line.startsWith(MARKER_SEPARATOR)) {
      separatorFound = true;
      continue;
    }

    if (separatorFound && line.startsWith(MARKER_THEIRS)) {
      theirsLabel = line.slice(MARKER_THEIRS.length).trim();
      endLine = i + 1; // 1-based
      break;
    }

    if (separatorFound) {
      theirsLines.push(line);
    } else {
      oursLines.push(line);
    }
  }

  if (!separatorFound) return null;

  return {
    startLine,
    endLine,
    ours: oursLines.join('\n'),
    theirs: theirsLines.join('\n'),
    oursLabel,
    theirsLabel,
  };
}

// ─── File Operations ────────────────────────────────────────────────────────

/**
 * Read a conflicted file and parse its conflict markers.
 *
 * @param cwd - Repository working directory
 * @param filePath - Path to the conflicted file (relative to cwd)
 * @returns Parsed ConflictFile with all hunks
 */
export async function readConflictFile(cwd: string, filePath: string): Promise<ConflictFile> {
  const fullPath = join(cwd, filePath);
  const content = await readFile(fullPath, 'utf-8');
  const hunks = parseConflictMarkers(content);

  return { filePath, hunks };
}

/**
 * Write resolved content to a file and stage it.
 *
 * @param cwd - Repository working directory
 * @param filePath - Path to the file (relative to cwd)
 * @param content - Resolved file content
 */
export async function writeResolution(
  cwd: string,
  filePath: string,
  content: string,
): Promise<void> {
  const fullPath = join(cwd, filePath);
  await writeFile(fullPath, content, 'utf-8');
  await execGitStrict({ cwd, args: ['add', '--', filePath] });
}
