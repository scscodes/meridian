/**
 * Git Domain — Index
 */

export { GitDomainService, createGitDomain, GIT_COMMANDS } from "./service";
export {
  createStatusHandler,
  createPullHandler,
  createCommitHandler,
} from "./handlers";
export { createSessionBriefingHandler } from "./session-handler";
export { aggregateSessionBriefing, SessionBriefingSources, HygieneScanGetter } from "./session-aggregator";
export {
  createShowAnalyticsHandler,
  createExportJsonHandler,
  createExportCsvHandler,
} from "./analytics-handler";
export { GitAnalyzer, gitReportToCsv } from "./analytics-service";
export {
  SessionBriefing,
  SessionBriefingReport,
  RecentRunEntry,
  ActivityWindow,
  HygieneSnapshot,
} from "./types";
export {
  AnalyticsPeriod,
  AnalyticsOptions,
  AnalyticsSummary,
  AuthorMetric,
  CommitMetric,
  CommitTrend,
  FileMetric,
  FileRiskLevel,
  GitAnalyticsReport,
  TrendData,
  VolatilityTrend,
  AnalyticsWebviewMessage,
  AnalyticsWebviewMessageType,
} from "./analytics-types";
