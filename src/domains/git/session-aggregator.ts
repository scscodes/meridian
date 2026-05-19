/**
 * Session Briefing Aggregator — framework-free, deterministic over injected sources.
 * Combines git state, run-log slice, git analytics, and hygiene scan into a
 * SessionBriefing record. Git-core failures are fail-fast; all peripheral
 * sources (run log, analytics, hygiene) are fail-soft: omit the slice and
 * append a visible flag so degradation surfaces in the briefing.
 */

import {
  GitProvider,
  Logger,
  Result,
  WorkspaceScan,
  RunCompleteEvent,
  RunFailEvent,
  success,
} from "../../types";
import { RunLog } from "../../infrastructure/run-log";
import { GitAnalyzer } from "./analytics-service";
import {
  SessionBriefing,
  RecentRunEntry,
  ActivityWindow,
  HygieneSnapshot,
} from "./types";
import { SESSION_BRIEFING } from "../../constants";

export type HygieneScanGetter = () => { scan: WorkspaceScan; scannedAt: string } | undefined;

export interface SessionBriefingSources {
  gitProvider: GitProvider;
  runLog: RunLog | undefined;
  gitAnalyzer: GitAnalyzer;
  getHygieneScan: HygieneScanGetter | undefined;
  logger: Logger;
  options?: { recentRunLimit?: number; recentCommitLimit?: number };
}

export async function aggregateSessionBriefing(
  sources: SessionBriefingSources
): Promise<Result<SessionBriefing>> {
  const { gitProvider, runLog, gitAnalyzer, getHygieneScan, logger, options } = sources;
  const recentRunLimit = options?.recentRunLimit ?? SESSION_BRIEFING.RECENT_RUN_LIMIT;
  const recentCommitLimit = options?.recentCommitLimit ?? SESSION_BRIEFING.RECENT_COMMIT_LIMIT;

  // Start peripheral fetches concurrently with git-core (all fail-soft).
  // Both are reject-safe — runLog.readLatest resolves a Result and never
  // throws; analyze() has a .catch — so a fail-fast git-core return below
  // cannot strand an unhandled rejection. This takes the analytics history
  // walk off the critical path on the common (git-core success) path.
  const runLogFetch = runLog ? runLog.readLatest(recentRunLimit) : null;
  const analyticsFetch = gitAnalyzer
    .analyze({ period: SESSION_BRIEFING.ANALYTICS_PERIOD })
    .catch((): null => null);

  // ── Git core — fail-fast ─────────────────────────────────────────────────
  const [statusResult, commitsResult, changesResult] = await Promise.all([
    gitProvider.status(),
    gitProvider.getRecentCommits(recentCommitLimit),
    gitProvider.getAllChanges(),
  ]);
  if (statusResult.kind === "err") return statusResult;
  if (commitsResult.kind === "err") return commitsResult;
  if (changesResult.kind === "err") return changesResult;

  const status = statusResult.value;
  const uncommitted = changesResult.value;
  const uncommittedFiles = uncommitted.map((f) => ({ path: f.path, status: f.status }));

  const flags: string[] = [];
  if (uncommitted.length > SESSION_BRIEFING.UNCOMMITTED_FILES_FLAG_THRESHOLD) {
    flags.push(`Large number of uncommitted files (${uncommitted.length})`);
  }
  if (status.branch === "HEAD") {
    flags.push("Detached HEAD — not on a named branch");
  }

  // ── Run log — fail-soft ──────────────────────────────────────────────────
  let recentRuns: RecentRunEntry[] | undefined;
  if (!runLogFetch) {
    flags.push("Run log unavailable");
  } else {
    const runLogResult = await runLogFetch;
    if (runLogResult.kind === "err") {
      logger.warn("Session briefing: run log read failed", "aggregateSessionBriefing", runLogResult.error);
      flags.push("Run log read failed");
    } else {
      const terminalEvents = runLogResult.value.filter(
        (e): e is RunCompleteEvent | RunFailEvent =>
          e.phase === "complete" || e.phase === "fail"
      );
      recentRuns = terminalEvents.map((e) => {
        const entry: RecentRunEntry = {
          runId: e.runId,
          commandName: e.commandName,
          workflowName: e.workflowName,
          skillName: e.skillName,
          phase: e.phase,
          durationMs: e.durationMs,
          timestampMs: e.timestampMs,
        };
        if (e.phase === "fail") {
          entry.errorCode = e.errorCode;
        }
        return entry;
      });
      const failCount = recentRuns.filter((r) => r.phase === "fail").length;
      if (failCount >= SESSION_BRIEFING.FAILED_RUNS_FLAG_THRESHOLD) {
        flags.push(`Recent run failures: ${failCount}`);
      }
    }
  }

  // ── Git analytics — fail-soft ────────────────────────────────────────────
  let activityWindow: ActivityWindow | undefined;
  const analyticsReport = await analyticsFetch;
  if (!analyticsReport) {
    logger.warn("Session briefing: analytics unavailable", "aggregateSessionBriefing");
    flags.push("Analytics unavailable");
  } else {
    activityWindow = {
      period: analyticsReport.period,
      commitsInWindow: analyticsReport.summary.totalCommits,
      filesTouched: analyticsReport.summary.totalFilesModified,
      topContributors: analyticsReport.topAuthors
        .slice(0, SESSION_BRIEFING.TOP_CONTRIBUTORS_LIMIT)
        .map((a) => ({ name: a.name, commits: a.commits })),
      trends: {
        commitDirection: analyticsReport.trends.commitTrend.direction,
        commitConfidence: analyticsReport.trends.commitTrend.confidence,
        volatilityDirection: analyticsReport.trends.volatilityTrend.direction,
      },
      topChurnFiles: analyticsReport.churnFiles
        .slice(0, SESSION_BRIEFING.CHURN_SAMPLE_LIMIT)
        .map((f) => ({ path: f.path, volatility: f.volatility, risk: f.risk })),
      commitFrequency: {
        labels: analyticsReport.commitFrequency.labels.slice(
          -SESSION_BRIEFING.SPARKLINE_MAX_POINTS
        ),
        data: analyticsReport.commitFrequency.data.slice(
          -SESSION_BRIEFING.SPARKLINE_MAX_POINTS
        ),
      },
    };
  }

  // ── Hygiene snapshot — fail-soft ─────────────────────────────────────────
  let hygieneSnapshot: HygieneSnapshot | undefined;
  const lastScan = getHygieneScan?.();
  if (lastScan) {
    const { scan, scannedAt } = lastScan;
    const deadCodeSample = scan.deadCode.items
      .slice(0, SESSION_BRIEFING.DEAD_CODE_SAMPLE_LIMIT)
      .map((d) => ({ filePath: d.filePath, line: d.line, message: d.message }));
    hygieneSnapshot = {
      scannedAt,
      deadFileCount: scan.deadFiles.length,
      largeFileCount: scan.largeFiles.length,
      logFileCount: scan.logFiles.length,
      deadCodeItemCount: scan.deadCode.items.length,
      ...(deadCodeSample.length > 0 ? { deadCodeSample } : {}),
    };
    if (scan.deadFiles.length >= SESSION_BRIEFING.DEAD_FILE_FLAG_THRESHOLD) {
      flags.push(`Hygiene: ${scan.deadFiles.length} dead files`);
    }
    if (scan.largeFiles.length >= SESSION_BRIEFING.LARGE_FILE_FLAG_THRESHOLD) {
      flags.push(`Hygiene: ${scan.largeFiles.length} large files`);
    }
  } else {
    flags.push("No hygiene scan yet");
  }

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
    recentRuns,
    activityWindow,
    hygieneSnapshot,
  });
}
