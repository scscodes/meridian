/**
 * Git Domain Types — Session Briefing aggregate.
 */

import { RecentCommit, CommandName } from "../../types";
import { AnalyticsPeriod } from "./analytics-types";

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
}

export interface HygieneSnapshot {
  scannedAt: string;
  deadFileCount: number;
  largeFileCount: number;
  logFileCount: number;
  deadCodeItemCount: number;
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
