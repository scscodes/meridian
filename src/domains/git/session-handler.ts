/**
 * Session Briefing Handler — thin prose consumer over the session aggregator.
 * Delegates data aggregation to aggregateSessionBriefing(), then layers AI
 * prose on top to produce the final SessionBriefingReport.
 */

import {
  Handler,
  CommandContext,
  GenerateProseFn,
  success,
} from "../../types";
import { getPrompt } from "../../infrastructure/prompt-registry";
import { SessionBriefingReport } from "./types";
import { SessionBriefingSources, aggregateSessionBriefing } from "./session-aggregator";

/**
 * git.sessionBriefing — Aggregate current workspace state and generate a
 * session briefing via the prose pipeline.
 */
export function createSessionBriefingHandler(
  sources: SessionBriefingSources,
  generateProseFn: GenerateProseFn
): Handler<Record<string, never>, SessionBriefingReport> {
  return async (_ctx: CommandContext) => {
    const aggResult = await aggregateSessionBriefing(sources);
    if (aggResult.kind === "err") return aggResult;

    const agg = aggResult.value;
    const { logger } = sources;

    const proseResult = await generateProseFn({
      domain: "git",
      systemPrompt: getPrompt("SESSION_BRIEFING"),
      data: {
        branch: agg.branch,
        isDirty: agg.isDirty,
        staged: agg.staged,
        unstaged: agg.unstaged,
        untracked: agg.untracked,
        recentCommits: agg.recentCommits,
        uncommittedFiles: agg.uncommittedFiles,
        flags: agg.flags,
        recentRuns: agg.recentRuns,
        activityWindow: agg.activityWindow,
        hygieneSnapshot: agg.hygieneSnapshot,
      },
    });

    if (proseResult.kind === "err") return proseResult;

    logger.info(`Session briefing generated for branch '${agg.branch}'`, "git.sessionBriefing");

    return success({ ...agg, summary: proseResult.value });
  };
}
