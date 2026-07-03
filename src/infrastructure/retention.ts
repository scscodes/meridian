/**
 * Retention engine (ADR 019) — self-policing for Meridian-owned storage.
 *
 * Scope is exactly three Meridian-owned locations, never anything else:
 *   1. `.meridian/artifacts/`            — exported reports (count + age caps)
 *   2. `.vscode/meridian/run-log.v1.jsonl` — via RunLog.compact (event cap)
 *   3. `.meridian/pulse/`                — self-capping (pulse-store), status only
 *
 * Enforcement is lazy (ADR 014 doctrine — no timers, no watchers): once at
 * activation (fire-and-forget) and after each artifacts quick-save. The
 * planning step is a pure function so the storage surface's "would prune"
 * preview and the actual prune can never disagree.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { AppError, Logger, Result, failure, success } from "../types";
import { MERIDIAN_ARTIFACTS_DIR, MERIDIAN_DIR, MERIDIAN_PULSE_DIR, PULSE } from "../constants";
import { INFRASTRUCTURE_ERROR_CODES } from "./error-codes";
import { readSetting } from "./settings";
import { RunLog, RUN_LOG_RELATIVE_PATH } from "./run-log";

const DAY_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// Policy
// ============================================================================

export interface RetentionPolicy {
  /** Keep at most this many artifact files; 0 disables the count rule. */
  artifactsMaxCount: number;
  /** Prune artifact files older than this many days; 0 disables the age rule. */
  artifactsMaxAgeDays: number;
  /** Compact the run log to its newest N events; 0 disables. */
  runLogMaxEvents: number;
}

/** Resolve the live policy through the ADR 013 settings chokepoint. */
export function getRetentionPolicy(): RetentionPolicy {
  return {
    artifactsMaxCount: Math.max(0, readSetting("retention.artifacts.maxCount")),
    artifactsMaxAgeDays: Math.max(0, readSetting("retention.artifacts.maxAgeDays")),
    runLogMaxEvents: Math.max(0, readSetting("retention.runLog.maxEvents")),
  };
}

// ============================================================================
// Planning (pure)
// ============================================================================

export interface ArtifactFileInfo {
  name: string;
  mtimeMs: number;
  sizeBytes: number;
}

/**
 * Decide which artifact files the policy removes. Pure. Age rule first, then
 * the count cap on survivors (oldest pruned first); newest files always win.
 */
export function planArtifactPrune(
  files: ReadonlyArray<ArtifactFileInfo>,
  policy: Pick<RetentionPolicy, "artifactsMaxCount" | "artifactsMaxAgeDays">,
  nowMs: number
): { keep: ArtifactFileInfo[]; prune: ArtifactFileInfo[] } {
  const byNewest = [...files].sort((a, b) => b.mtimeMs - a.mtimeMs);
  const prune: ArtifactFileInfo[] = [];
  const keep: ArtifactFileInfo[] = [];

  for (const file of byNewest) {
    const tooOld =
      policy.artifactsMaxAgeDays > 0 &&
      nowMs - file.mtimeMs > policy.artifactsMaxAgeDays * DAY_MS;
    const overCount = policy.artifactsMaxCount > 0 && keep.length >= policy.artifactsMaxCount;
    if (tooOld || overCount) {
      prune.push(file);
    } else {
      keep.push(file);
    }
  }
  return { keep, prune };
}

// ============================================================================
// Filesystem inventory
// ============================================================================

function artifactsDirPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, MERIDIAN_DIR, MERIDIAN_ARTIFACTS_DIR);
}

/**
 * Inventory the artifacts dir: regular files only, excluding the self-ignore
 * `.gitignore` (never a prune target). Missing dir → empty inventory.
 */
export async function listArtifacts(workspaceRoot: string): Promise<ArtifactFileInfo[]> {
  const dir = artifactsDirPath(workspaceRoot);
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const files: ArtifactFileInfo[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || entry.name === ".gitignore") continue;
    try {
      const stat = await fs.stat(path.join(dir, entry.name));
      files.push({ name: entry.name, mtimeMs: stat.mtimeMs, sizeBytes: stat.size });
    } catch {
      // Raced deletion — skip.
    }
  }
  return files;
}

// ============================================================================
// Enforcement
// ============================================================================

export interface PruneOutcome {
  deletedCount: number;
  freedBytes: number;
}

function makeError(message: string, details: unknown, context: string): AppError {
  return { code: INFRASTRUCTURE_ERROR_CODES.RETENTION_ERROR, message, details, context };
}

/**
 * Apply the artifact policy: plan, then unlink. Only basenames returned by
 * listArtifacts are ever joined to the artifacts dir — no external input
 * reaches a path. A single failed unlink is logged and skipped, not fatal.
 */
export async function pruneArtifacts(
  workspaceRoot: string,
  policy: Pick<RetentionPolicy, "artifactsMaxCount" | "artifactsMaxAgeDays">,
  logger: Logger
): Promise<Result<PruneOutcome>> {
  try {
    const files = await listArtifacts(workspaceRoot);
    const { prune } = planArtifactPrune(files, policy, Date.now());
    const dir = artifactsDirPath(workspaceRoot);

    let deletedCount = 0;
    let freedBytes = 0;
    for (const file of prune) {
      try {
        await fs.unlink(path.join(dir, file.name));
        deletedCount += 1;
        freedBytes += file.sizeBytes;
      } catch (err) {
        logger.warn(
          `Retention: failed to prune artifact ${file.name}: ${String(err)}`,
          "pruneArtifacts"
        );
      }
    }
    if (deletedCount > 0) {
      logger.info(
        `Retention: pruned ${deletedCount} artifact(s), freed ${freedBytes} bytes`,
        "pruneArtifacts"
      );
    }
    return success({ deletedCount, freedBytes });
  } catch (err) {
    return failure(makeError("Artifact prune failed", err, "pruneArtifacts"));
  }
}

/**
 * Activation-time retention pass: artifacts prune + run-log compaction.
 * Both legs fail-soft with a warning — retention must never block activation.
 */
export async function runActivationRetention(
  workspaceRoot: string,
  runLog: RunLog,
  logger: Logger
): Promise<void> {
  const policy = getRetentionPolicy();

  const pruneResult = await pruneArtifacts(workspaceRoot, policy, logger);
  if (pruneResult.kind === "err") {
    logger.warn("Retention: activation artifact prune failed", "runActivationRetention", pruneResult.error);
  }

  const compactResult = await runLog.compact(policy.runLogMaxEvents);
  if (compactResult.kind === "err") {
    logger.warn("Retention: run-log compaction failed", "runActivationRetention", compactResult.error);
  } else if (compactResult.value > 0) {
    logger.info(`Retention: run log compacted (${compactResult.value} events dropped)`, "runActivationRetention");
  }
}

// ============================================================================
// Storage status (the storage surface's data source)
// ============================================================================

export interface StorageStatus {
  artifacts: {
    fileCount: number;
    totalBytes: number;
    oldestMtimeMs: number | null;
    /** Dry-run of the CURRENT policy — shares planArtifactPrune with the real prune. */
    wouldPruneCount: number;
    wouldPruneBytes: number;
  };
  runLog: { sizeBytes: number; lineCount: number };
  pulse: { sizeBytes: number; snapshotCount: number; maxSnapshots: number };
  policy: RetentionPolicy;
}

async function fileLineStats(filePath: string): Promise<{ sizeBytes: number; lineCount: number }> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return {
      sizeBytes: Buffer.byteLength(raw, "utf8"),
      lineCount: raw.split("\n").filter((l) => l.trim().length > 0).length,
    };
  } catch {
    return { sizeBytes: 0, lineCount: 0 };
  }
}

export async function computeStorageStatus(workspaceRoot: string): Promise<Result<StorageStatus>> {
  try {
    const policy = getRetentionPolicy();
    const files = await listArtifacts(workspaceRoot);
    const { prune } = planArtifactPrune(files, policy, Date.now());

    const runLogStats = await fileLineStats(path.join(workspaceRoot, RUN_LOG_RELATIVE_PATH));
    const pulseStats = await fileLineStats(
      path.join(workspaceRoot, MERIDIAN_DIR, MERIDIAN_PULSE_DIR, "pulse.v1.jsonl")
    );

    return success({
      artifacts: {
        fileCount: files.length,
        totalBytes: files.reduce((sum, f) => sum + f.sizeBytes, 0),
        oldestMtimeMs: files.length > 0 ? Math.min(...files.map((f) => f.mtimeMs)) : null,
        wouldPruneCount: prune.length,
        wouldPruneBytes: prune.reduce((sum, f) => sum + f.sizeBytes, 0),
      },
      runLog: runLogStats,
      pulse: { ...pulseStats, snapshotCount: pulseStats.lineCount, maxSnapshots: PULSE.MAX_SNAPSHOTS },
      policy,
    });
  } catch (err) {
    return failure(makeError("Storage status failed", err, "computeStorageStatus"));
  }
}
