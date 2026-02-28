/**
 * Hygiene Analytics Handler — entry point for hygiene.showAnalytics command.
 */

import { Handler, CommandContext, success, failure, Logger } from "../../types";
import { HygieneAnalyticsReport, PruneConfig, PRUNE_DEFAULTS } from "./analytics-types";
import { HygieneAnalyzer } from "./analytics-service";
import { DeadCodeAnalyzer } from "./dead-code-analyzer";

export function createShowHygieneAnalyticsHandler(
  analyzer: HygieneAnalyzer,
  deadCodeAnalyzer: DeadCodeAnalyzer,
  logger: Logger
): Handler<Partial<PruneConfig>, HygieneAnalyticsReport> {
  return async (ctx: CommandContext, params: Partial<PruneConfig> = {}) => {
    try {
      const workspaceRoot = ctx.workspaceFolders?.[0] ?? process.cwd();

      // Merge caller-supplied config with defaults
      const config: PruneConfig = {
        minAgeDays:   params.minAgeDays   ?? PRUNE_DEFAULTS.minAgeDays,
        maxSizeMB:    params.maxSizeMB    ?? PRUNE_DEFAULTS.maxSizeMB,
        minLineCount: params.minLineCount ?? PRUNE_DEFAULTS.minLineCount,
        categories:   params.categories   ?? PRUNE_DEFAULTS.categories,
      };

      // Run dead code scan first (cached); pass into file analyzer so the
      // temporal chart can bucket issues by file modification date.
      const deadCode = deadCodeAnalyzer.analyze(workspaceRoot);
      const report   = analyzer.analyze(workspaceRoot, config, deadCode);

      logger.info(
        `Hygiene analytics: ${report.summary.totalFiles} files, ${report.summary.pruneCount} prune candidates, ${deadCode.items.length} dead code items`,
        "HygieneAnalyticsHandler"
      );

      return success(report);
    } catch (err) {
      return failure({
        code: "HYGIENE_ANALYTICS_ERROR",
        message: "Hygiene analytics failed",
        details: err,
        context: "hygiene.showAnalytics",
      });
    }
  };
}
