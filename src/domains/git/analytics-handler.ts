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

/**
 * Create export handler for JSON
 */
export function createExportJsonHandler(
  analyzer: GitAnalyzer,
  _logger: Logger
): Handler<AnalyticsOptions, string> {
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
            : GIT_ERROR_CODES.EXPORT_ERROR,
          message: validation.error.message,
          context: "ExportJsonHandler",
        });
      }
      const options = validation.value;

      const report = await analyzer.analyze(options);
      const json = analyzer.exportToJSON(report);

      return success(json);
    } catch (err) {
      return failure({
        code: GIT_ERROR_CODES.EXPORT_ERROR,
        message: `Failed to export JSON: ${err instanceof Error ? err.message : String(err)}`,
        context: "ExportJsonHandler",
        details: err,
      });
    }
  };
}

/**
 * Create export handler for CSV
 */
export function createExportCsvHandler(
  analyzer: GitAnalyzer,
  _logger: Logger
): Handler<AnalyticsOptions, string> {
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
            : GIT_ERROR_CODES.EXPORT_ERROR,
          message: validation.error.message,
          context: "ExportCsvHandler",
        });
      }
      const options = validation.value;

      const report = await analyzer.analyze(options);
      const csv = analyzer.exportToCSV(report);

      return success(csv);
    } catch (err) {
      return failure({
        code: GIT_ERROR_CODES.EXPORT_ERROR,
        message: `Failed to export CSV: ${err instanceof Error ? err.message : String(err)}`,
        context: "ExportCsvHandler",
        details: err,
      });
    }
  };
}
