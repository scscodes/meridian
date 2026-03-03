/**
 * Git Domain — Index
 */

export { GitDomainService, createGitDomain, GIT_COMMANDS } from "./service";
export { ChangeGrouper, CommitMessageSuggester, BatchCommitter } from "./smart-commit-service";
export { InboundAnalyzer } from "./inbound-analyzer";
export {
  createStatusHandler,
  createPullHandler,
  createCommitHandler,
} from "./handlers";
export {
  createSmartCommitHandler,
  parseFileChanges,
} from "./smart-commit-handler";
export {
  createAnalyzeInboundHandler,
} from "./inbound-handler";
export {
  createGeneratePRHandler,
  createReviewPRHandler,
  createCommentPRHandler,
  createResolveConflictsHandler,
  gatherPRContext,
  GenerateProseFn,
} from "./pr-handlers";
export {
  createShowAnalyticsHandler,
  createExportJsonHandler,
  createExportCsvHandler,
} from "./analytics-handler";
export { GitAnalyzer } from "./analytics-service";
export {
  FileChange,
  ChangeGroup,
  CommitType,
  SuggestedMessage,
  CommitInfo,
  SmartCommitBatchResult,
  SmartCommitParams,
  ApprovalItem,
  ApprovalUI,
  InboundChanges,
  ConflictFile,
  ChangesSummary,
  PRGenerationParams,
  GeneratedPR,
  PRContext,
  PRReviewParams,
  GeneratedPRReview,
  PRReviewComment,
  PRCommentParams,
  GeneratedPRComments,
  InlineComment,
  ConflictResolutionProse,
  ConflictResolution,
} from "./types";
export {
  AnalyticsPeriod,
  AnalyticsOptions,
  AnalyticsSummary,
  AuthorMetric,
  CachedAnalytics,
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
