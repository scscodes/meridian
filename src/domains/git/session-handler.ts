/**
 * Session Briefing Handler — thin prose consumer over the session aggregator.
 * Delegates data aggregation to aggregateSessionBriefing(), then layers an
 * optional AI prose summary on top to produce the final SessionBriefingReport.
 *
 * Prose is a garnish, not the product (ADR 012): when no language model is
 * available — or prose generation fails for any reason — the briefing degrades
 * to a deterministic, computed summary rather than erroring. The structured
 * fields are always present regardless.
 */

import {
  Handler,
  CommandContext,
  GenerateProseFn,
  Result,
  success,
} from "../../types";
import { getPrompt } from "../../infrastructure/prompt-registry";
import { SessionBriefing, SessionBriefingReport } from "./types";
import { SessionBriefingSources, aggregateSessionBriefing } from "./session-aggregator";

/**
 * Deterministic plain-text briefing built purely from the computed aggregate.
 * Rendered via textContent in the webview, so plain text with newlines — no
 * markdown syntax. Used verbatim when no prose layer is available.
 */
function deterministicSummary(agg: SessionBriefing): string {
  const lines: string[] = [];

  const state = agg.isDirty ? "dirty" : "clean";
  lines.push(
    `Branch '${agg.branch}' — ${state} ` +
      `(staged: ${agg.staged}, unstaged: ${agg.unstaged}, untracked: ${agg.untracked}).`
  );
  lines.push(
    `${agg.recentCommits.length} recent commit${agg.recentCommits.length === 1 ? "" : "s"}, ` +
      `${agg.uncommittedFiles.length} uncommitted file${agg.uncommittedFiles.length === 1 ? "" : "s"}.`
  );

  if (agg.activityWindow) {
    const w = agg.activityWindow;
    lines.push(
      `Activity (${w.period}): ${w.commitsInWindow} commits across ${w.filesTouched} files.`
    );
    if (w.trends) {
      lines.push(
        `Momentum: commits ${w.trends.commitDirection} ` +
          `(confidence ${w.trends.commitConfidence.toFixed(2)}), ` +
          `volatility ${w.trends.volatilityDirection}.`
      );
    }
    if (w.topChurnFiles && w.topChurnFiles.length > 0) {
      lines.push("Top churn:");
      for (const f of w.topChurnFiles) {
        lines.push(`  • ${f.path} (volatility ${f.volatility.toFixed(1)}, ${f.risk} risk)`);
      }
    }
  }

  if (agg.hygieneSnapshot) {
    const h = agg.hygieneSnapshot;
    lines.push(
      `Hygiene (scanned ${h.scannedAt}): ${h.deadFileCount} dead, ` +
        `${h.largeFileCount} large, ${h.logFileCount} logs, ${h.deadCodeItemCount} dead-code items.`
    );
    if (h.deadCodeSample && h.deadCodeSample.length > 0) {
      lines.push("Dead code:");
      for (const d of h.deadCodeSample) {
        lines.push(`  • ${d.filePath}:${d.line} — ${d.message}`);
      }
    }
  }

  if (agg.pulse?.deltas && agg.pulse.previousAt) {
    const d = agg.pulse.deltas;
    const parts: string[] = [];
    const fmt = (label: string, v: number | undefined): void => {
      if (v !== undefined && v !== 0) parts.push(`${label} ${v > 0 ? "+" : ""}${v}`);
    };
    fmt("commits-in-window", d.commitsInWindow);
    fmt("files-touched", d.filesTouched);
    fmt("dead files", d.deadFileCount);
    fmt("large files", d.largeFileCount);
    fmt("dead-code items", d.deadCodeItemCount);
    fmt("uncommitted", d.uncommittedCount);
    lines.push(
      `Pulse since ${agg.pulse.previousAt}: ` +
        (parts.length > 0 ? parts.join(", ") + "." : "no movement.")
    );
  }

  if (agg.pendingChangeRisk && agg.pendingChangeRisk.totalChanged > 0) {
    const p = agg.pendingChangeRisk;
    lines.push(
      `Pending-change risk: ${p.totalChanged} changed file${p.totalChanged === 1 ? "" : "s"}, ` +
        `${p.hotspotCount} high-risk.`
    );
    const hot = p.files.filter((f) => f.risk === "high");
    if (hot.length > 0) {
      lines.push("High-risk:");
      for (const f of hot) {
        lines.push(
          `  • ${f.path} (volatility ${f.volatility?.toFixed(1) ?? "—"}, churn ${f.churn ?? "—"})`
        );
      }
    }
  }

  if (agg.pendingChangeCompanions && agg.pendingChangeCompanions.files.length > 0) {
    const c = agg.pendingChangeCompanions;
    lines.push(
      `Possibly forgotten companions: ${c.count} file${c.count === 1 ? "" : "s"} ` +
        `usually change with your current edits.`
    );
    for (const f of c.files) {
      const pct = Math.round(f.coChangeRate * 100);
      const because = f.becauseOf.length > 0 ? ` (with ${f.becauseOf.join(", ")}, ${pct}%)` : ` (${pct}%)`;
      lines.push(`  • ${f.path}${because}`);
    }
  }

  if (agg.flags.length > 0) {
    lines.push("");
    lines.push("Flags:");
    for (const f of agg.flags) lines.push(`  • ${f}`);
  }

  return lines.join("\n");
}

/**
 * git.sessionBriefing — Aggregate current workspace state and produce a
 * session briefing. Prose is optional and degradable.
 */
export function createSessionBriefingHandler(
  sources: SessionBriefingSources,
  generateProseFn?: GenerateProseFn
): Handler<Record<string, never>, SessionBriefingReport> {
  return async (_ctx: CommandContext) => {
    const aggResult = await aggregateSessionBriefing(sources);
    if (aggResult.kind === "err") return aggResult;

    const agg = aggResult.value;
    const { logger } = sources;

    const fallback = (): Result<SessionBriefingReport> =>
      success({ ...agg, summary: deterministicSummary(agg) });

    if (!generateProseFn) {
      logger.info(
        `Session briefing generated for branch '${agg.branch}' (deterministic — no language model)`,
        "git.sessionBriefing"
      );
      return fallback();
    }

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
        pendingChangeRisk: agg.pendingChangeRisk,
        pendingChangeCompanions: agg.pendingChangeCompanions,
        pulse: agg.pulse,
      },
    });

    if (proseResult.kind === "err") {
      logger.warn(
        `Session briefing prose unavailable (${proseResult.error.code}); using deterministic summary`,
        "git.sessionBriefing",
        proseResult.error
      );
      return fallback();
    }

    logger.info(`Session briefing generated for branch '${agg.branch}'`, "git.sessionBriefing");

    return success({ ...agg, summary: proseResult.value });
  };
}
