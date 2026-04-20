/**
 * Skill Domain Service — built-in composite commands.
 */

import {
  AppError,
  DomainService,
  SkillCommandName,
  Handler,
  Logger,
  Result,
  RUN_EVENT_SCHEMA_VERSION,
  RunEventV1,
  success,
} from "../../types";
import { createOverviewHandler, createPrReadyHandler, createPreMergeHandler, CommandDispatcher } from "./handlers";
import { createRunEventId, createRunId, RunLog } from "../../infrastructure/run-log";

export const SKILL_COMMANDS: SkillCommandName[] = [
  "skill.overview",
  "skill.prReady",
  "skill.preMerge",
];

export class SkillDomainService implements DomainService {
  readonly name = "skill";
  handlers: Partial<Record<SkillCommandName, Handler<any, any>>> = {};
  private logger: Logger;
  private readonly runLog?: RunLog;

  constructor(logger: Logger, dispatcher: CommandDispatcher, runLog?: RunLog) {
    this.logger = logger;
    this.runLog = runLog;
    this.handlers = {
      "skill.overview": this.withRunLogging(
        "skill.overview",
        createOverviewHandler(dispatcher, logger)
      ),
      "skill.prReady": this.withRunLogging(
        "skill.prReady",
        createPrReadyHandler(dispatcher, logger)
      ),
      "skill.preMerge": this.withRunLogging(
        "skill.preMerge",
        createPreMergeHandler(dispatcher, logger)
      ),
    };
  }

  async initialize(): Promise<Result<void>> {
    this.logger.info("Skill domain initialized", "SkillDomainService");
    return success(void 0);
  }

  async teardown(): Promise<void> {
    this.logger.debug("Skill domain torn down", "SkillDomainService");
  }

  private withRunLogging<TParams, TResult>(
    skillName: SkillCommandName,
    handler: Handler<TParams, TResult>
  ): Handler<TParams, TResult> {
    return async (ctx, params) => {
      const runId = ctx.runId ?? createRunId("skill");
      const parentRunId = ctx.parentRunId;
      const startTime = Date.now();

      await this.emitRunEvent({
        schemaVersion: RUN_EVENT_SCHEMA_VERSION,
        eventId: createRunEventId(),
        runId,
        parentRunId,
        timestampMs: startTime,
        source: "skill",
        phase: "start",
        commandName: skillName,
        skillName,
      });

      try {
        const result = await handler({ ...ctx, runId, parentRunId }, params);
        const durationMs = Date.now() - startTime;
        if (result.kind === "ok") {
          await this.emitRunEvent({
            schemaVersion: RUN_EVENT_SCHEMA_VERSION,
            eventId: createRunEventId(),
            runId,
            parentRunId,
            timestampMs: Date.now(),
            source: "skill",
            phase: "complete",
            commandName: skillName,
            skillName,
            resultKind: "ok",
            durationMs,
          });
        } else {
          await this.emitRunEvent({
            schemaVersion: RUN_EVENT_SCHEMA_VERSION,
            eventId: createRunEventId(),
            runId,
            parentRunId,
            timestampMs: Date.now(),
            source: "skill",
            phase: "fail",
            commandName: skillName,
            skillName,
            resultKind: "err",
            durationMs,
            errorCode: result.error.code,
            errorMessage: result.error.message,
          });
        }
        return result;
      } catch (err) {
        const appErr: AppError = {
          code: "SKILL_EXECUTION_ERROR",
          message: err instanceof Error ? err.message : String(err),
          details: err,
          context: skillName,
        };
        await this.emitRunEvent({
          schemaVersion: RUN_EVENT_SCHEMA_VERSION,
          eventId: createRunEventId(),
          runId,
          parentRunId,
          timestampMs: Date.now(),
          source: "skill",
          phase: "fail",
          commandName: skillName,
          skillName,
          resultKind: "err",
          durationMs: Date.now() - startTime,
          errorCode: appErr.code,
          errorMessage: appErr.message,
        });
        throw err;
      }
    };
  }

  private async emitRunEvent(event: RunEventV1): Promise<void> {
    if (!this.runLog) return;
    const appendResult = await this.runLog.append(event);
    if (appendResult.kind === "err") {
      this.logger.warn(
        "Run log: append failed (skill continues)",
        "SkillDomainService.emitRunEvent",
        appendResult.error
      );
    }
  }
}

export function createSkillDomain(
  logger: Logger,
  dispatcher: CommandDispatcher,
  runLog?: RunLog
): SkillDomainService {
  return new SkillDomainService(logger, dispatcher, runLog);
}
