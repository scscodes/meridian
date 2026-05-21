/**
 * Git Analytics Handler — Entry point for git.showAnalytics command
 */

import {
  Handler,
  CommandContext,
  success,
  failure,
  Logger,
} from "../../types";
import { GIT_ERROR_CODES } from "../../infrastructure/error-codes";
import { AnalyticsOptions, GitAnalyticsReport } from "./analytics-types";
import { GitAnalyzer } from "./analytics-service";
import { validateAnalyticsOptions } from "./analytics-validation";

/**
 * Create the analytics handler
 */
export function createShowAnalyticsHandler(
  analyzer: GitAnalyzer,
  logger: Logger
): Handler<AnalyticsOptions, GitAnalyticsReport> {
  return async (
    _ctx: CommandContext,
    params: Partial<AnalyticsOptions> = {}
  ) => {
    try {
      const validation = validateAnalyticsOptions(params);
      if (!validation.ok) {
        return failure({
          code: validation.error.code === "INVALID_PERIOD"
            ? GIT_ERROR_CODES.INVALID_PERIOD
            : GIT_ERROR_CODES.ANALYTICS_ERROR,
          message: validation.error.message,
          context: "ShowAnalyticsHandler",
        });
      }
      const options = validation.value;

      logger.info(
        `Running analytics for period: ${options.period}`,
        "ShowAnalyticsHandler"
      );

      const report = await analyzer.analyze(options);

      logger.info(
        `Analytics complete: ${report.summary.totalCommits} commits by ${report.summary.totalAuthors} authors`,
        "ShowAnalyticsHandler"
      );

      return success(report);
    } catch (err) {
      const error = {
        code: GIT_ERROR_CODES.ANALYTICS_ERROR,
        message: `Failed to generate analytics: ${err instanceof Error ? err.message : String(err)}`,
        context: "ShowAnalyticsHandler",
        details: err,
      };
      logger.error(
        `Analytics failed: ${error.message}`,
        "ShowAnalyticsHandler",
        error
      );
      return failure(error);
    }
  };
}
