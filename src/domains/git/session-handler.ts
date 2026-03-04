/**
 * Session Briefing Handler — Morning-briefing prose consumer.
 * Gathers current branch state, recent commits, and uncommitted changes,
 * then generates a concise session briefing via the prose pipeline.
 */

import {
  Handler,
  CommandContext,
  success,
  Logger,
  GitProvider,
} from "../../types";
import { GenerateProseFn } from "./pr-handlers";

const SESSION_BRIEFING_PROMPT = `You are a developer assistant generating a morning session briefing.
Given the current git branch state, recent commits, and uncommitted changes, produce a concise briefing.

Output format (markdown):
# Session Briefing — <branch name>

## Branch State
<1-2 sentences: branch name, whether it is dirty, staged/unstaged counts>

## Recent Commits
<bulleted list of last N commits with short hash and message>

## Uncommitted Changes
<bulleted list of modified files, or "None" if clean>

## Flags
<any notable issues: many uncommitted files, detached HEAD, etc. Omit section if none.>

Guidelines:
- Keep it scannable — bullets over prose
- Flag anything that needs attention before starting work
- If the workspace is clean, say so clearly`;

/**
 * git.sessionBriefing — Generate a session briefing from current workspace state.
 */
export function createSessionBriefingHandler(
  gitProvider: GitProvider,
  logger: Logger,
  generateProseFn: GenerateProseFn
): Handler<Record<string, never>, string> {
  return async (_ctx: CommandContext) => {
    // 1. Current branch + dirty state
    const statusResult = await gitProvider.status();
    if (statusResult.kind === "err") return statusResult;
    const status = statusResult.value;

    // 2. Recent commits (last 10)
    const commitsResult = await gitProvider.getRecentCommits(10);
    if (commitsResult.kind === "err") return commitsResult;

    // 3. Uncommitted file list
    const changesResult = await gitProvider.getAllChanges();
    if (changesResult.kind === "err") return changesResult;

    const uncommitted = changesResult.value;

    // Flags: surface anything worth highlighting
    const flags: string[] = [];
    if (uncommitted.length > 10) {
      flags.push(`Large number of uncommitted files (${uncommitted.length})`);
    }
    if (status.branch === "HEAD") {
      flags.push("Detached HEAD — not on a named branch");
    }

    const proseResult = await generateProseFn({
      domain: "git",
      systemPrompt: SESSION_BRIEFING_PROMPT,
      data: {
        branch: status.branch,
        isDirty: status.isDirty,
        staged: status.staged,
        unstaged: status.unstaged,
        untracked: status.untracked,
        recentCommits: commitsResult.value,
        uncommittedFiles: uncommitted.map((f) => ({ path: f.path, status: f.status })),
        flags,
      },
    });

    if (proseResult.kind === "err") return proseResult;

    logger.info(`Session briefing generated for branch '${status.branch}'`, "git.sessionBriefing");
    return success(proseResult.value);
  };
}
