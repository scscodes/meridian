/**
 * Pulse store — append-only, versioned JSONL history of per-session workspace
 * snapshots, the longitudinal substrate behind the session briefing's pulse
 * slice (ADR 019). Modeled on FileRunLog (ADR 009): serialized writes through
 * a queue, schema-version guard on both append and read.
 *
 * Location: `.meridian/pulse/pulse.v1.jsonl` (ADR 014 dotdir). The dir is
 * self-ignoring (a `.gitignore` containing `*` is dropped on first write, the
 * artifacts-dir pattern) — pulse data is host-local insight; sharing an
 * append-only JSONL through git would merge-conflict across machines.
 */

import { promises as fs } from "node:fs";
import * as fsSync from "node:fs";
import path from "node:path";
import { AppError, Logger, Result, failure, success } from "../types";
import { MERIDIAN_DIR, MERIDIAN_PULSE_DIR, PULSE } from "../constants";
import { INFRASTRUCTURE_ERROR_CODES } from "./error-codes";
import { compactJsonlTail } from "./jsonl-tail";

export const PULSE_SCHEMA_VERSION = 1 as const;

/**
 * One stored snapshot. Optional fields mirror the briefing's fail-soft
 * peripheral slices: absent when the source was unavailable at capture time,
 * never zero-filled (a 0 means "measured as zero", absence means "not
 * measured").
 */
export interface PulseSnapshotV1 {
  schemaVersion: typeof PULSE_SCHEMA_VERSION;
  timestampMs: number;
  branch: string;
  uncommittedCount: number;
  commitsInWindow?: number;
  filesTouched?: number;
  deadFileCount?: number;
  largeFileCount?: number;
  logFileCount?: number;
  deadCodeItemCount?: number;
  hotspotCount?: number;
}

export function isSupportedPulseVersion(version: unknown): version is typeof PULSE_SCHEMA_VERSION {
  return version === PULSE_SCHEMA_VERSION;
}

export interface PulseStore {
  /** Append one snapshot; tail-compacts past PULSE.MAX_SNAPSHOTS. */
  append(snapshot: PulseSnapshotV1): Promise<Result<void>>;
  /** Newest `limit` snapshots, oldest→newest order. */
  readLatest(limit: number): Promise<Result<PulseSnapshotV1[]>>;
}

function makeError(code: string, message: string, details: unknown, context: string): AppError {
  return { code, message, details, context };
}

export class FilePulseStore implements PulseStore {
  private readonly dirPath: string;
  private readonly filePath: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(workspaceRoot: string, private readonly logger: Logger) {
    this.dirPath = path.join(workspaceRoot, MERIDIAN_DIR, MERIDIAN_PULSE_DIR);
    this.filePath = path.join(this.dirPath, `pulse.v${PULSE_SCHEMA_VERSION}.jsonl`);
  }

  async append(snapshot: PulseSnapshotV1): Promise<Result<void>> {
    if (!isSupportedPulseVersion(snapshot.schemaVersion)) {
      return failure(
        makeError(
          INFRASTRUCTURE_ERROR_CODES.PULSE_VERSION_UNSUPPORTED,
          `Pulse store: unsupported schemaVersion ${String(snapshot.schemaVersion)} (append rejected)`,
          snapshot,
          "FilePulseStore.append"
        )
      );
    }
    try {
      await this.enqueue(async () => {
        await fs.mkdir(this.dirPath, { recursive: true });
        this.writeSelfIgnore();
        await fs.appendFile(this.filePath, JSON.stringify(snapshot) + "\n", "utf8");
        await compactJsonlTail(this.filePath, PULSE.MAX_SNAPSHOTS);
      });
      return success(void 0);
    } catch (err) {
      return failure(
        makeError(
          INFRASTRUCTURE_ERROR_CODES.PULSE_WRITE_ERROR,
          `Pulse store: append failed (${this.filePath})`,
          err,
          "FilePulseStore.append"
        )
      );
    }
  }

  async readLatest(limit: number): Promise<Result<PulseSnapshotV1[]>> {
    const safeLimit = Math.max(0, Math.trunc(limit));
    if (safeLimit === 0) return success([]);

    let raw: string;
    try {
      raw = await fs.readFile(this.filePath, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return success([]);
      return failure(
        makeError(
          INFRASTRUCTURE_ERROR_CODES.PULSE_READ_ERROR,
          `Pulse store: read failed (${this.filePath})`,
          err,
          "FilePulseStore.readLatest"
        )
      );
    }

    const snapshots: PulseSnapshotV1[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        // Tolerate a torn/corrupt line (e.g. crash mid-append): drop it with a
        // warning rather than fail the whole history — pulse is a peripheral,
        // fail-soft source by contract (unlike the run log's strict reader).
        this.logger.warn("Pulse store: skipping malformed line", "FilePulseStore.readLatest");
        continue;
      }
      if (
        typeof parsed !== "object" || parsed === null ||
        !isSupportedPulseVersion((parsed as { schemaVersion?: unknown }).schemaVersion)
      ) {
        this.logger.warn("Pulse store: skipping unsupported-version line", "FilePulseStore.readLatest");
        continue;
      }
      snapshots.push(parsed as PulseSnapshotV1);
    }
    return success(snapshots.slice(-safeLimit));
  }

  /**
   * Idempotently drop the self-ignoring `.gitignore` (`*`). Sync + swallowed:
   * the write is tiny, one-shot, and non-fatal (matches the artifacts-dir
   * writer in webview-provider.ts).
   */
  private writeSelfIgnore(): void {
    try {
      const gitignore = path.join(this.dirPath, ".gitignore");
      if (!fsSync.existsSync(gitignore)) fsSync.writeFileSync(gitignore, "*\n", "utf-8");
    } catch (e) {
      this.logger.warn(`Pulse store: self-ignore write failed: ${String(e)}`, "FilePulseStore");
    }
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    const run = this.writeQueue.then(task);
    this.writeQueue = run.catch(() => {
      // Error propagates to append()'s caller; the queue itself must not stall.
    });
    return run;
  }
}

export function createPulseStore(workspaceRoot: string, logger: Logger): PulseStore {
  return new FilePulseStore(workspaceRoot, logger);
}
