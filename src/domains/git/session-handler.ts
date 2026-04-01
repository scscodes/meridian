/**
 * Session Briefing Handler — Morning-briefing prose consumer.
 * Gathers current branch state, recent commits, and uncommitted changes,
 * then generates a concise session briefing via the prose pipeline.
 */

import {
  Handler,
  CommandContext,
  GenerateProseFn,
  success,
  Logger,
  GitProvider,
} from "../../types";
import { getPrompt } from "../../infrastructure/prompt-registry";
import { SessionBriefingReport } from "./types";

/**
 * git.sessionBriefing — Generate a session briefing from current workspace state.
 */
export function createSessionBriefingHandler(
  gitProvider: GitProvider,
  logger: Logger,
  generateProseFn: GenerateProseFn
): Handler<Record<string, never>, SessionBriefingReport> {
  return async (_ctx: CommandContext) => {
    const [statusResult, commitsResult, changesResult] = await Promise.all([
      gitProvider.status(),
      gitProvider.getRecentCommits(10),
      gitProvider.getAllChanges(),
    ]);
    if (statusResult.kind === "err") return statusResult;
    if (commitsResult.kind === "err") return commitsResult;
    if (changesResult.kind === "err") return changesResult;
    const status = statusResult.value;

    const uncommitted = changesResult.value;

    // Flags: surface anything worth highlighting
    const flags: string[] = [];
    if (uncommitted.length > 10) {
      flags.push(`Large number of uncommitted files (${uncommitted.length})`);
    }
    if (status.branch === "HEAD") {
      flags.push("Detached HEAD — not on a named branch");
    }

    const uncommittedFiles = uncommitted.map((f) => ({ path: f.path, status: f.status }));

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
        uncommittedFiles,
        flags,
      },
    });

    if (proseResult.kind === "err") return proseResult;

    logger.info(`Session briefing generated for branch '${status.branch}'`, "git.sessionBriefing");

    return success({
      generatedAt: new Date().toISOString(),
      branch: status.branch,
      isDirty: status.isDirty,
      staged: status.staged,
      unstaged: status.unstaged,
      untracked: status.untracked,
      recentCommits: commitsResult.value,
      uncommittedFiles,
      flags,
      summary: proseResult.value,
    });
  };
}
