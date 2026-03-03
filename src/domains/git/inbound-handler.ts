/**
 * Inbound Handler — Analyze remote changes without pulling.
 */

import {
  Handler,
  CommandContext,
  success,
  failure,
  Logger,
} from "../../types";
import { InboundChanges } from "./types";
import { InboundAnalyzer } from "./inbound-analyzer";

/**
 * Example: git.analyzeInbound — Analyze remote changes without pulling.
 * Detects conflicts between local and remote modifications.
 */
export function createAnalyzeInboundHandler(
  inboundAnalyzer: InboundAnalyzer,
  logger: Logger
): Handler<any, InboundChanges> {
  return async (_ctx: CommandContext, _params: any = {}) => {
    try {
      logger.info("Analyzing inbound changes from remote", "GitAnalyzeInboundHandler");

      const result = await inboundAnalyzer.analyze();

      if (result.kind === "err") {
        logger.error(
          "Failed to analyze inbound changes",
          "GitAnalyzeInboundHandler",
          result.error
        );
        return result;
      }

      const analysis = result.value;
      logger.info(
        `Inbound analysis complete: ${analysis.totalInbound} remote changes, ${analysis.conflicts.length} conflicts`,
        "GitAnalyzeInboundHandler"
      );

      return success(analysis);
    } catch (err) {
      logger.error(
        "Unexpected error during inbound analysis",
        "GitAnalyzeInboundHandler",
        {
          code: "INBOUND_ANALYSIS_ERROR",
          message: "Failed to analyze inbound changes",
          details: err,
        }
      );

      return failure({
        code: "INBOUND_ANALYSIS_ERROR",
        message: "Failed to analyze inbound changes",
        details: err,
        context: "git.analyzeInbound",
      });
    }
  };
}
