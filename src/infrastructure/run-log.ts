/**
 * Run log infrastructure — append-only, versioned JSONL event store.
 * Each line is one serialized RunEventV1 record.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  AppError,
  Logger,
  Result,
  RunEventV1,
  failure,
  isSupportedRunEventVersion,
  success,
} from "../types";
import { INFRASTRUCTURE_ERROR_CODES } from "./error-codes";

const RUN_LOG_RELATIVE_PATH = ".vscode/meridian/run-log.v1.jsonl";

export function createRunEventId(): string {
  return randomUUID();
}

export function createRunId(prefix = "run"): string {
  return `${prefix}-${randomUUID()}`;
}

export interface RunLog {
  append(event: RunEventV1): Promise<Result<void>>;
  appendMany(events: RunEventV1[]): Promise<Result<void>>;
  readByRunId(runId: string): Promise<Result<RunEventV1[]>>;
  readLatest(limit: number): Promise<Result<RunEventV1[]>>;
}

function makeError(
  code: string,
  message: string,
  details: unknown,
  context: string
): AppError {
  return { code, message, details, context };
}

export class FileRunLog implements RunLog {
  private readonly filePath: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(workspaceRoot: string, private readonly logger: Logger) {
    this.filePath = path.join(workspaceRoot, RUN_LOG_RELATIVE_PATH);
  }

  async append(event: RunEventV1): Promise<Result<void>> {
    return this.appendMany([event]);
  }

  async appendMany(events: RunEventV1[]): Promise<Result<void>> {
    if (events.length === 0) return success(void 0);
    for (const event of events) {
      if (!isSupportedRunEventVersion(event.schemaVersion)) {
        return failure(
          makeError(
            INFRASTRUCTURE_ERROR_CODES.RUN_LOG_VERSION_UNSUPPORTED,
            `Run log: unsupported schemaVersion ${event.schemaVersion} (append rejected)`,
            event,
            "FileRunLog.appendMany"
          )
        );
      }
    }

    const payload = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
    try {
      await this.enqueueWrite(payload);
      return success(void 0);
    } catch (err) {
      return failure(
        makeError(
          INFRASTRUCTURE_ERROR_CODES.RUN_LOG_WRITE_ERROR,
          `Run log: append failed (${this.filePath})`,
          err,
          "FileRunLog.appendMany"
        )
      );
    }
  }

  async readByRunId(runId: string): Promise<Result<RunEventV1[]>> {
    const all = await this.readAll();
    if (all.kind === "err") return all;
    return success(all.value.filter((event) => event.runId === runId));
  }

  async readLatest(limit: number): Promise<Result<RunEventV1[]>> {
    const safeLimit = Math.max(0, Math.trunc(limit));
    const all = await this.readAll();
    if (all.kind === "err") return all;
    if (safeLimit === 0) return success([]);
    return success(all.value.slice(-safeLimit));
  }

  private async enqueueWrite(payload: string): Promise<void> {
    const writeTask = this.writeQueue.then(async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.appendFile(this.filePath, payload, "utf8");
    });
    this.writeQueue = writeTask.catch((err) => {
      this.logger.warn(
        "Run log: queued append failed (see error)",
        "FileRunLog.enqueueWrite",
        makeError(
          INFRASTRUCTURE_ERROR_CODES.RUN_LOG_WRITE_ERROR,
          "Run log: queued append failed",
          err,
          "FileRunLog.enqueueWrite"
        )
      );
    });
    return writeTask;
  }

  private async readAll(): Promise<Result<RunEventV1[]>> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
      const events: RunEventV1[] = [];
      for (const line of lines) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch (err) {
          return failure(
            makeError(
              INFRASTRUCTURE_ERROR_CODES.RUN_LOG_PARSE_ERROR,
              `Run log: invalid JSON line (${this.filePath})`,
              err,
              "FileRunLog.readAll"
            )
          );
        }

        if (
          typeof parsed !== "object" ||
          parsed == null ||
          !("schemaVersion" in parsed) ||
          !isSupportedRunEventVersion((parsed as { schemaVersion: number }).schemaVersion)
        ) {
          return failure(
            makeError(
              INFRASTRUCTURE_ERROR_CODES.RUN_LOG_VERSION_UNSUPPORTED,
              "Run log: unsupported schemaVersion (line rejected)",
              parsed,
              "FileRunLog.readAll"
            )
          );
        }
        events.push(parsed as RunEventV1);
      }
      return success(events);
    } catch (err) {
      const maybeErr = err as NodeJS.ErrnoException;
      if (maybeErr.code === "ENOENT") return success([]);
      return failure(
        makeError(
          INFRASTRUCTURE_ERROR_CODES.RUN_LOG_READ_ERROR,
          `Run log: read failed (${this.filePath})`,
          err,
          "FileRunLog.readAll"
        )
      );
    }
  }
}

export function createRunLog(workspaceRoot: string, logger: Logger): RunLog {
  return new FileRunLog(workspaceRoot, logger);
}

