/**
 * Skill Domain Handlers — composite commands that chain existing commands.
 */

import {
  Handler,
  CommandContext,
  Command,
  Result,
  success,
  failure,
  Logger,
  GitStatus,
  WorkspaceScan,
} from "../../types";
import { SKILL_ERROR_CODES } from "../../infrastructure/error-codes";
import { GeneratedPR, GeneratedPRReview, ConflictResolutionProse, InboundChanges } from "../git/types";
import { SkillOverviewResult, SkillPrReadyResult, SkillPreMergeResult } from "./types";

/** Dispatcher interface — same as chat.delegate uses */
export type CommandDispatcher = (
  command: Command,
  ctx: CommandContext
) => Promise<Result<unknown>>;

export function createOverviewHandler(
  dispatcher: CommandDispatcher,
  logger: Logger
): Handler<Record<string, never>, SkillOverviewResult> {
  return async (ctx: CommandContext) => {
    try {
      logger.info("Running session overview skill", "SkillOverviewHandler");

      const statusResult = await dispatcher({ name: "git.status" as any, params: {} }, ctx);
      if (statusResult.kind !== "ok") {
        return failure({ code: SKILL_ERROR_CODES.SKILL_STEP_FAILED, message: "git.status failed", details: statusResult.error, context: "skill.overview" });
      }

      const briefingResult = await dispatcher({ name: "git.sessionBriefing" as any, params: {} }, ctx);
      if (briefingResult.kind !== "ok") {
        return failure({ code: SKILL_ERROR_CODES.SKILL_STEP_FAILED, message: "git.sessionBriefing failed", details: briefingResult.error, context: "skill.overview" });
      }

      return success({
        status: statusResult.value as GitStatus,
        briefing: briefingResult.value as string,
      });
    } catch (err) {
      return failure({ code: SKILL_ERROR_CODES.SKILL_EXECUTION_ERROR, message: "Session overview failed", details: err, context: "skill.overview" });
    }
  };
}

export function createPrReadyHandler(
  dispatcher: CommandDispatcher,
  logger: Logger
): Handler<Record<string, never>, SkillPrReadyResult> {
  return async (ctx: CommandContext) => {
    try {
      logger.info("Running PR readiness check skill", "SkillPrReadyHandler");

      const scanResult = await dispatcher({ name: "hygiene.scan" as any, params: {} }, ctx);
      if (scanResult.kind !== "ok") {
        return failure({ code: SKILL_ERROR_CODES.SKILL_STEP_FAILED, message: "hygiene.scan failed", details: scanResult.error, context: "skill.prReady" });
      }

      const reviewResult = await dispatcher({ name: "git.reviewPR" as any, params: {} }, ctx);
      if (reviewResult.kind !== "ok") {
        return failure({ code: SKILL_ERROR_CODES.SKILL_STEP_FAILED, message: "git.reviewPR failed", details: reviewResult.error, context: "skill.prReady" });
      }

      const prResult = await dispatcher({ name: "git.generatePR" as any, params: {} }, ctx);
      if (prResult.kind !== "ok") {
        return failure({ code: SKILL_ERROR_CODES.SKILL_STEP_FAILED, message: "git.generatePR failed", details: prResult.error, context: "skill.prReady" });
      }

      return success({
        scan: scanResult.value as WorkspaceScan,
        review: reviewResult.value as GeneratedPRReview,
        pr: prResult.value as GeneratedPR,
      });
    } catch (err) {
      return failure({ code: SKILL_ERROR_CODES.SKILL_EXECUTION_ERROR, message: "PR readiness check failed", details: err, context: "skill.prReady" });
    }
  };
}

export function createPreMergeHandler(
  dispatcher: CommandDispatcher,
  logger: Logger
): Handler<Record<string, never>, SkillPreMergeResult> {
  return async (ctx: CommandContext) => {
    try {
      logger.info("Running pre-merge check skill", "SkillPreMergeHandler");

      const inboundResult = await dispatcher({ name: "git.analyzeInbound" as any, params: {} }, ctx);
      if (inboundResult.kind !== "ok") {
        return failure({ code: SKILL_ERROR_CODES.SKILL_STEP_FAILED, message: "git.analyzeInbound failed", details: inboundResult.error, context: "skill.preMerge" });
      }

      const conflictsResult = await dispatcher({ name: "git.resolveConflicts" as any, params: {} }, ctx);
      if (conflictsResult.kind !== "ok") {
        return failure({ code: SKILL_ERROR_CODES.SKILL_STEP_FAILED, message: "git.resolveConflicts failed", details: conflictsResult.error, context: "skill.preMerge" });
      }

      return success({
        inbound: inboundResult.value as InboundChanges,
        conflicts: conflictsResult.value as ConflictResolutionProse,
      });
    } catch (err) {
      return failure({ code: SKILL_ERROR_CODES.SKILL_EXECUTION_ERROR, message: "Pre-merge check failed", details: err, context: "skill.preMerge" });
    }
  };
}
