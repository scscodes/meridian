/**
 * Git Domain Types — Session Briefing aggregate.
 */

import { RecentCommit, CommandName, GitFileChange } from "../../types";
import { AnalyticsPeriod, TrendDirection, FileRiskLevel } from "./analytics-types";

// ============================================================================
// Session Briefing Types
// ============================================================================

export interface RecentRunEntry {
  runId: string;
  commandName?: CommandName;
  workflowName?: string;
  skillName?: string;
  phase: "complete" | "fail";
  durationMs?: number;
  errorCode?: string;
  timestampMs: number;
}

export interface ActivityWindow {
  period: AnalyticsPeriod;
  commitsInWindow: number;
  filesTouched: number;
  topContributors: Array<{ name: string; commits: number }>;
  /**
   * Directional momentum from the analytics report. Optional: omitted whenever
   * the analytics peripheral is unavailable (fail-soft), like the rest of this
   * slice. Tiny payload, unique signal (ADR 011 Current state).
   */
  trends?: {
    commitDirection: TrendDirection;
    commitConfidence: number;
    volatilityDirection: TrendDirection;
  };
  /**
   * Bounded sample of the highest-volatility files (already computed in the
   * analytics report as `churnFiles`, previously discarded). Length capped by
   * SESSION_BRIEFING.CHURN_SAMPLE_LIMIT.
   */
  topChurnFiles?: Array<{ path: string; volatility: number; risk: FileRiskLevel }>;
  /**
   * Tail of the commit-frequency series (already computed in the analytics
   * report, previously discarded) for the briefing sparkline — the shape
   * behind the trend arrow. Optional and fail-soft like the rest of this
   * slice; length capped by SESSION_BRIEFING.SPARKLINE_MAX_POINTS. Viz-only:
   * carried into JSON export and prose data, intentionally not surfaced in the
   * explicit-field CSV or the deterministic plain-text summary.
   */
  commitFrequency?: { labels: string[]; data: number[] };
}

export interface HygieneSnapshot {
  scannedAt: string;
  deadFileCount: number;
  largeFileCount: number;
  logFileCount: number;
  deadCodeItemCount: number;
  /**
   * Bounded sample of dead-code items with locations (already computed in the
   * cached scan, previously collapsed to a count only). Length capped by
   * SESSION_BRIEFING.DEAD_CODE_SAMPLE_LIMIT. Omitted when there are none.
   */
  deadCodeSample?: Array<{ filePath: string; line: number; message: string }>;
}

/**
 * One changed (dirty) file annotated with its computed risk. `churn` /
 * `volatility` are null and `risk` is `"new"` (status A — no history) or
 * `"cold"` (status M/D but untouched in the analytics window — low, not
 * unknown) when the file has no FileMetric in the analytics window;
 * otherwise they carry the analytics values and `risk` is the FileMetric tier.
 */
export interface PendingChangeFile {
  path: string;
  status: GitFileChange["status"];
  churn: number | null;
  volatility: number | null;
  risk: FileRiskLevel | "new" | "cold";
}

/**
 * Deterministic join of the dirty-set against the already-computed analytics
 * risk model — surfaces which files you are about to commit are historically
 * dangerous. Optional top-level slice (NOT nested in ActivityWindow): present
 * iff the analytics peripheral is available; the dirty-set itself is git-core
 * (fail-fast) so it is always known when this slice is present. `files` is
 * sorted risk→volatility→path desc and capped at PENDING_RISK.MAX_FILES;
 * `totalChanged` / `hotspotCount` are computed from the full pre-cap set so
 * the headline counts stay accurate even when the table is truncated.
 */
export interface PendingChangeRisk {
  totalChanged: number;
  hotspotCount: number;
  capped: boolean;
  files: PendingChangeFile[];
}

/**
 * One file that historically ships with the current dirty set but is NOT itself
 * dirty — a "possibly forgotten" companion. `count` / `coChangeRate` are the
 * strongest (max) co-change link to any dirty file; `becauseOf` names the dirty
 * file(s) it commonly changes with, bounded by COMPANIONS.BECAUSE_OF_LIMIT.
 */
export interface PendingCompanion {
  path: string;
  count: number;
  coChangeRate: number;
  becauseOf: string[];
}

/**
 * Deterministic join of the dirty-set against the already-computed analytics
 * `coChange` list — surfaces files you usually change alongside your current
 * edits but have not touched yet. Optional top-level slice (parallel to
 * `pendingChangeRisk`): present iff the analytics peripheral is available AND
 * at least one companion clears COMPANIONS.MIN_CONFIDENCE; otherwise omitted.
 * `files` is sorted rate→count→path and capped at COMPANIONS.MAX_FILES;
 * `count` is the full pre-cap total and `capped` signals truncation.
 */
export interface PendingChangeCompanions {
  count: number;
  capped: boolean;
  files: PendingCompanion[];
}

/** One point of the pulse series — a stored snapshot reduced to chartable fields. */
export interface PulsePoint {
  timestampMs: number;
  uncommittedCount: number;
  commitsInWindow?: number;
  deadFileCount?: number;
}

/**
 * Longitudinal pulse — how the workspace moved since the previous briefing
 * (ADR 019). Additive, optional, fail-soft slice (ADR 011 rule): present iff
 * a pulse store was injected and readable. `deltas` fields are current minus
 * previous, present only when both sides were measured; `series` is
 * oldest→newest and includes the current (possibly not-yet-stored) point;
 * `appended` is false when the store's min-interval throttle suppressed the
 * write for this briefing.
 */
export interface PulseSlice {
  previousAt?: string;
  deltas?: {
    uncommittedCount: number;
    commitsInWindow?: number;
    filesTouched?: number;
    deadFileCount?: number;
    largeFileCount?: number;
    deadCodeItemCount?: number;
  };
  series: PulsePoint[];
  appended: boolean;
}

/**
 * Closed producer-side set of flag ids the aggregator can emit. Consumers of
 * the public JSON contract (ADR 020) must still treat ids as an OPEN set —
 * this union exists for compile-time safety inside the extension (a typo'd
 * id in the aggregator or a test fails to compile), not as a wire guarantee.
 */
export type FlagId =
  | "uncommitted.many"
  | "head.detached"
  | "runlog.unavailable"
  | "runlog.readFailed"
  | "runs.failures"
  | "analytics.unavailable"
  | "risk.hotspots"
  | "companions.missing"
  | "hygiene.noScan"
  | "hygiene.deadFiles"
  | "hygiene.largeFiles"
  | "pulse.unavailable"
  | "pulse.notRecorded";

/**
 * One structured flag emitted by the aggregator (ADR 011-style additive
 * slice): `flags: string[]` is derived from `flagItems` (`message` in
 * insertion order) so the two can never drift. `id` is a stable machine
 * identifier for UI wiring (e.g. anchors, actions) — deliberately free of
 * anchors, action names, or any other DOM concept, since this type is
 * frozen into a public JSON contract (unknown ids/severities must be
 * tolerated by external consumers per ADR 020).
 */
export interface FlagItem {
  id: FlagId;
  severity: "warn" | "info";
  message: string;
}

export interface SessionBriefing {
  generatedAt: string;
  branch: string;
  isDirty: boolean;
  staged: number;
  unstaged: number;
  untracked: number;
  recentCommits: RecentCommit[];
  uncommittedFiles: Array<{ path: string; status: "A" | "M" | "D" | "R" }>;
  flags: string[];
  /**
   * Structured counterpart to `flags` (additive slice, ADR 011 style). The
   * aggregator always populates it — `flags` is derived from it — so it is
   * required: an optional field here would force dead defensive branches in
   * every consumer for a producer state that cannot occur.
   */
  flagItems: FlagItem[];
  recentRuns?: RecentRunEntry[];
  activityWindow?: ActivityWindow;
  hygieneSnapshot?: HygieneSnapshot;
  pendingChangeRisk?: PendingChangeRisk;
  pendingChangeCompanions?: PendingChangeCompanions;
  pulse?: PulseSlice;
}

export type SessionBriefingReport = SessionBriefing & { summary: string };
