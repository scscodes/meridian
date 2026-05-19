/**
 * Git Domain Types — Session Briefing aggregate.
 */

import { RecentCommit, CommandName } from "../../types";
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
  recentRuns?: RecentRunEntry[];
  activityWindow?: ActivityWindow;
  hygieneSnapshot?: HygieneSnapshot;
}

export type SessionBriefingReport = SessionBriefing & { summary: string };
