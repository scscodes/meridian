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
import { getPrompt } from "../../infrastructure/prompt-registry";

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
      systemPrompt: getPrompt("SESSION_BRIEFING"),
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
