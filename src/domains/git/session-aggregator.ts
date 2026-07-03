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
import { PulseSnapshotV1, PulseStore, PULSE_SCHEMA_VERSION } from "../../infrastructure/pulse-store";
import { GitAnalyzer } from "./analytics-service";
import { CoChangePair, FileMetric } from "./analytics-types";
import { normalizeRenamePath } from "./git-path";
import {
  SessionBriefing,
  RecentRunEntry,
  ActivityWindow,
  HygieneSnapshot,
  PendingChangeRisk,
  PendingChangeFile,
  PendingChangeCompanions,
  PendingCompanion,
  PulseSlice,
} from "./types";
import { SESSION_BRIEFING, PENDING_RISK, COMPANIONS, PULSE } from "../../constants";

export type HygieneScanGetter = () => { scan: WorkspaceScan; scannedAt: string } | undefined;

export interface SessionBriefingSources {
  gitProvider: GitProvider;
  runLog: RunLog | undefined;
  gitAnalyzer: GitAnalyzer;
  getHygieneScan: HygieneScanGetter | undefined;
  pulseStore?: PulseStore;
  logger: Logger;
  options?: { recentRunLimit?: number; recentCommitLimit?: number };
}

/**
 * Deterministic risk ordering for the pending-change table: dangerous files
 * first; a brand-new file (no history) ahead of a known-low file; a "cold"
 * file (changed but quiet in the analytics window — low, not unknown) last.
 */
const RISK_RANK: Record<PendingChangeFile["risk"], number> = {
  high: 5,
  medium: 4,
  new: 3,
  low: 2,
  cold: 1,
};

/**
 * Join the dirty-set against the already-computed analytics risk model. Pure,
 * no I/O. Dirty paths are rename-normalized (the analytics `FileMetric.path`
 * side already is — shared `normalizeRenamePath`) then deduped: `getAllChanges`
 * already merges staged+unstaged by raw path, so this residual dedupe only
 * catches rename+further-edit. Files absent from the analytics window are
 * annotated `"new"` (status A → no history) or `"cold"` (status M/D → changed
 * but quiet in-window: low, not unknown). Sorted risk→volatility→path desc;
 * `totalChanged`/`hotspotCount` come from the FULL pre-cap set; the table is
 * capped at PENDING_RISK.MAX_FILES with `capped` signalling truncation.
 */
function computePendingChangeRisk(
  uncommitted: ReadonlyArray<{ path: string; status: PendingChangeFile["status"] }>,
  files: ReadonlyArray<FileMetric>
): PendingChangeRisk {
  const metricByPath = new Map<string, FileMetric>();
  for (const f of files) metricByPath.set(f.path, f);

  const deduped = new Map<string, PendingChangeFile["status"]>();
  for (const c of uncommitted) {
    const key = normalizeRenamePath(c.path);
    if (!deduped.has(key)) deduped.set(key, c.status);
  }

  const annotated: PendingChangeFile[] = [];
  for (const [path, status] of deduped) {
    const metric = metricByPath.get(path);
    annotated.push(
      metric
        ? {
            path,
            status,
            churn: metric.commitCount,
            volatility: metric.volatility,
            risk: metric.risk,
          }
        : {
            path,
            status,
            churn: null,
            volatility: null,
            risk: status === "A" ? "new" : "cold",
          }
    );
  }

  annotated.sort((a, b) => {
    const r = RISK_RANK[b.risk] - RISK_RANK[a.risk];
    if (r !== 0) return r;
    const v = (b.volatility ?? -1) - (a.volatility ?? -1);
    if (v !== 0) return v;
    return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  });

  return {
    totalChanged: annotated.length,
    hotspotCount: annotated.filter((f) => f.risk === "high").length,
    capped: annotated.length > PENDING_RISK.MAX_FILES,
    files: annotated.slice(0, PENDING_RISK.MAX_FILES),
  };
}

/**
 * Join the dirty-set against the already-computed analytics `coChange` list to
 * surface files that historically ship with the current changes but are not
 * themselves dirty ("possibly forgotten"). Pure, no I/O. For each pair with
 * exactly one side dirty and a rate at/above COMPANIONS.MIN_CONFIDENCE, the
 * non-dirty side is a companion; entries are aggregated by companion (max
 * count/rate, dirty triggers collected into `becauseOf`), sorted
 * rate→count→path, and capped at COMPANIONS.MAX_FILES. Returns undefined when
 * no companion qualifies, so the briefing omits the slice (and its section).
 */
function computePendingChangeCompanions(
  uncommitted: ReadonlyArray<{ path: string; status: PendingChangeFile["status"] }>,
  coChange: ReadonlyArray<CoChangePair>
): PendingChangeCompanions | undefined {
  const dirty = new Set<string>();
  for (const c of uncommitted) dirty.add(normalizeRenamePath(c.path));

  // companion path → aggregated link strength + triggering dirty files
  const byCompanion = new Map<
    string,
    { count: number; coChangeRate: number; becauseOf: Set<string> }
  >();

  for (const pair of coChange) {
    const aDirty = dirty.has(pair.a);
    const bDirty = dirty.has(pair.b);
    if (aDirty === bDirty) continue; // both or neither → not a suggestion
    if (pair.coChangeRate < COMPANIONS.MIN_CONFIDENCE) continue;

    const companion = aDirty ? pair.b : pair.a;
    const trigger = aDirty ? pair.a : pair.b;

    const entry = byCompanion.get(companion) ?? {
      count: 0,
      coChangeRate: 0,
      becauseOf: new Set<string>(),
    };
    entry.count = Math.max(entry.count, pair.count);
    entry.coChangeRate = Math.max(entry.coChangeRate, pair.coChangeRate);
    entry.becauseOf.add(trigger);
    byCompanion.set(companion, entry);
  }

  if (byCompanion.size === 0) return undefined;

  const files: PendingCompanion[] = Array.from(byCompanion, ([path, e]) => ({
    path,
    count: e.count,
    coChangeRate: e.coChangeRate,
    becauseOf: Array.from(e.becauseOf).sort().slice(0, COMPANIONS.BECAUSE_OF_LIMIT),
  }));

  files.sort(
    (a, b) =>
      b.coChangeRate - a.coChangeRate ||
      b.count - a.count ||
      (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  );

  return {
    count: files.length,
    capped: files.length > COMPANIONS.MAX_FILES,
    files: files.slice(0, COMPANIONS.MAX_FILES),
  };
}

/**
 * Optional snapshot fields carried into the pulse deltas. A delta exists only
 * when the field was measured on BOTH sides (absence means "not measured",
 * never zero — matching PulseSnapshotV1).
 */
const PULSE_DELTA_FIELDS = [
  "commitsInWindow",
  "filesTouched",
  "deadFileCount",
  "largeFileCount",
  "deadCodeItemCount",
] as const;

/**
 * Build the pulse slice from stored history plus the just-captured current
 * snapshot. Pure, exported for tests. `series` includes `current` as its
 * final point regardless of whether the throttle let it be stored — the
 * chart should always end at "now".
 */
export function buildPulseSlice(
  history: ReadonlyArray<PulseSnapshotV1>,
  current: PulseSnapshotV1,
  appended: boolean
): PulseSlice {
  const previous = history.length > 0 ? history[history.length - 1] : undefined;
  const slice: PulseSlice = {
    series: [...history, current]
      .slice(-PULSE.SERIES_LIMIT)
      .map((s) => ({
        timestampMs: s.timestampMs,
        uncommittedCount: s.uncommittedCount,
        ...(s.commitsInWindow !== undefined ? { commitsInWindow: s.commitsInWindow } : {}),
        ...(s.deadFileCount !== undefined ? { deadFileCount: s.deadFileCount } : {}),
      })),
    appended,
  };
  if (previous) {
    slice.previousAt = new Date(previous.timestampMs).toISOString();
    const deltas: NonNullable<PulseSlice["deltas"]> = {
      uncommittedCount: current.uncommittedCount - previous.uncommittedCount,
    };
    for (const field of PULSE_DELTA_FIELDS) {
      const curr = current[field];
      const prev = previous[field];
      if (curr !== undefined && prev !== undefined) deltas[field] = curr - prev;
    }
    slice.deltas = deltas;
  }
  return slice;
}

export async function aggregateSessionBriefing(
  sources: SessionBriefingSources
): Promise<Result<SessionBriefing>> {
  const { gitProvider, runLog, gitAnalyzer, getHygieneScan, pulseStore, logger, options } = sources;
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
  let pendingChangeRisk: PendingChangeRisk | undefined;
  let pendingChangeCompanions: PendingChangeCompanions | undefined;
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

    pendingChangeRisk = computePendingChangeRisk(uncommitted, analyticsReport.files);
    if (pendingChangeRisk.hotspotCount >= PENDING_RISK.HOTSPOT_FLAG_THRESHOLD) {
      flags.push(`Modifying ${pendingChangeRisk.hotspotCount} high-risk files`);
    }

    pendingChangeCompanions = computePendingChangeCompanions(
      uncommitted,
      analyticsReport.coChange ?? []
    );
    if (
      pendingChangeCompanions &&
      pendingChangeCompanions.count >= COMPANIONS.FLAG_THRESHOLD
    ) {
      flags.push(
        `Possibly missing ${pendingChangeCompanions.count} companion file${pendingChangeCompanions.count === 1 ? "" : "s"}`
      );
    }
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

  // ── Pulse history — fail-soft ────────────────────────────────────────────
  let pulse: PulseSlice | undefined;
  if (pulseStore) {
    const historyResult = await pulseStore.readLatest(PULSE.SERIES_LIMIT);
    if (historyResult.kind === "err") {
      logger.warn("Session briefing: pulse history read failed", "aggregateSessionBriefing", historyResult.error);
      flags.push("Pulse history unavailable");
    } else {
      const history = historyResult.value;
      const previous = history.length > 0 ? history[history.length - 1] : undefined;
      const current: PulseSnapshotV1 = {
        schemaVersion: PULSE_SCHEMA_VERSION,
        timestampMs: Date.now(),
        branch: status.branch,
        uncommittedCount: uncommitted.length,
        ...(activityWindow
          ? { commitsInWindow: activityWindow.commitsInWindow, filesTouched: activityWindow.filesTouched }
          : {}),
        ...(hygieneSnapshot
          ? {
              deadFileCount: hygieneSnapshot.deadFileCount,
              largeFileCount: hygieneSnapshot.largeFileCount,
              logFileCount: hygieneSnapshot.logFileCount,
              deadCodeItemCount: hygieneSnapshot.deadCodeItemCount,
            }
          : {}),
        ...(pendingChangeRisk ? { hotspotCount: pendingChangeRisk.hotspotCount } : {}),
      };

      let appended = false;
      const throttled =
        previous !== undefined &&
        current.timestampMs - previous.timestampMs < PULSE.MIN_APPEND_INTERVAL_MS;
      if (!throttled) {
        const appendResult = await pulseStore.append(current);
        if (appendResult.kind === "err") {
          logger.warn("Session briefing: pulse append failed", "aggregateSessionBriefing", appendResult.error);
          flags.push("Pulse history not recorded");
        } else {
          appended = true;
        }
      }
      pulse = buildPulseSlice(history, current, appended);
    }
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
    pendingChangeRisk,
    pendingChangeCompanions,
    pulse,
  });
}
