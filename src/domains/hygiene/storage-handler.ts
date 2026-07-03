/**
 * Hygiene Storage Handlers — meridian self-policing surface (ADR 019).
 *
 * hygiene.storageStatus — footprint + would-prune preview for Meridian-owned
 * storage (artifacts, run log, pulse). hygiene.pruneStorage — apply the
 * retention policy now (artifacts prune + run-log compaction). Thin wrappers
 * over infrastructure/retention.ts; the preview and the prune share one
 * planner, so they cannot disagree.
 *
 * Both handlers come from one factory sharing a TtlCache: the hygiene tree
 * dispatches storageStatus on every root rebuild (debounced-watcher driven),
 * and the status read includes a full run-log line count — the cache bounds
 * that to once per CACHE_SETTINGS.STORAGE_STATUS_TTL_MS. A successful prune
 * invalidates, so the post-prune refresh never serves the stale preview.
 */

import { CommandContext, Handler, Logger, Result, failure, success } from "../../types";
import {
  StorageStatus,
  computeStorageStatus,
  getRetentionPolicy,
  pruneArtifacts,
  PruneOutcome,
} from "../../infrastructure/retention";
import { RunLog } from "../../infrastructure/run-log";
import { INFRASTRUCTURE_ERROR_CODES } from "../../infrastructure/error-codes";
import { TtlCache } from "../../infrastructure/cache";
import { CACHE_SETTINGS } from "../../constants";

export interface PruneStorageOutcome {
  artifacts: PruneOutcome;
  runLogDropped: number;
}

export interface StorageHandlers {
  storageStatus: Handler<Record<string, never>, StorageStatus>;
  pruneStorage: Handler<Record<string, never>, PruneStorageOutcome>;
}

function resolveRoot(ctx: CommandContext, fallbackRoot?: string): string | undefined {
  return ctx.workspaceFolders?.[0] ?? fallbackRoot;
}

function noWorkspace(context: string): Result<never> {
  return failure({
    code: INFRASTRUCTURE_ERROR_CODES.WORKSPACE_NOT_FOUND,
    message: "No workspace folder open — Meridian storage lives per-workspace",
    details: undefined,
    context,
  });
}

export function createStorageHandlers(
  logger: Logger,
  runLog?: RunLog,
  fallbackRoot?: string
): StorageHandlers {
  const statusCache = new TtlCache<string, StorageStatus>(CACHE_SETTINGS.STORAGE_STATUS_TTL_MS);

  const storageStatus: StorageHandlers["storageStatus"] = async (ctx) => {
    const root = resolveRoot(ctx, fallbackRoot);
    if (!root) return noWorkspace("hygiene.storageStatus");

    const cached = statusCache.get(root);
    if (cached) return success(cached);

    const result = await computeStorageStatus(root);
    if (result.kind === "ok") statusCache.set(root, result.value);
    return result;
  };

  const pruneStorage: StorageHandlers["pruneStorage"] = async (ctx) => {
    const root = resolveRoot(ctx, fallbackRoot);
    if (!root) return noWorkspace("hygiene.pruneStorage");

    const policy = getRetentionPolicy();
    const artifactsResult = await pruneArtifacts(root, policy, logger);
    if (artifactsResult.kind === "err") return artifactsResult;

    // Run-log compaction is best-effort: a failure downgrades to a warning
    // and the artifacts outcome still reports.
    let runLogDropped = 0;
    if (runLog) {
      const compactResult = await runLog.compact(policy.runLogMaxEvents);
      if (compactResult.kind === "err") {
        logger.warn("Prune storage: run-log compaction failed", "hygiene.pruneStorage", compactResult.error);
      } else {
        runLogDropped = compactResult.value;
      }
    }

    statusCache.delete(root);
    logger.info(
      `Storage pruned: ${artifactsResult.value.deletedCount} artifact(s), ${runLogDropped} run-log event(s)`,
      "hygiene.pruneStorage"
    );
    return success({ artifacts: artifactsResult.value, runLogDropped });
  };

  return { storageStatus, pruneStorage };
}
