/**
 * Git Analytics Types — Data model for analytics reporting
 */

/**
 * Analytics time period
 */
export type AnalyticsPeriod = "3mo" | "6mo" | "12mo";

/**
 * Risk level for files based on volatility
 */
export type FileRiskLevel = "high" | "medium" | "low";

/**
 * Trend direction
 */
export type TrendDirection = "up" | "stable" | "down";

/**
 * Individual commit metric from git history
 */
export interface CommitFileChange {
  path: string;
  insertions: number;
  deletions: number;
}

export interface CommitMetric {
  hash: string;
  author: string;
  date: Date;
  filesChanged: number;
  insertions: number;
  deletions: number;
  message: string;
  files: CommitFileChange[];
}

/**
 * File-level statistics aggregated over period
 */
export interface FileMetric {
  path: string;
  commitCount: number;
  insertions: number;
  deletions: number;
  volatility: number; // (insertions + deletions) / commitCount
  authors: string[];
  lastModified: Date;
  risk: FileRiskLevel;
}

/**
 * Author contribution statistics
 */
export interface AuthorMetric {
  name: string;
  commits: number;
  insertions: number;
  deletions: number;
  filesChanged: number;
  lastActive: Date;
}

/**
 * Trend data: slope analysis of commit and volatility metrics
 */
export interface CommitTrend {
  slope: number; // positive = increasing, negative = decreasing
  direction: TrendDirection;
  confidence: number; // 0-1
}

export interface VolatilityTrend {
  slope: number;
  direction: TrendDirection;
}

export interface TrendData {
  commitTrend: CommitTrend;
  volatilityTrend: VolatilityTrend;
}

/**
 * Summary statistics across entire period
 */
export interface AnalyticsSummary {
  totalCommits: number;
  totalAuthors: number;
  totalFilesModified: number;
  totalLinesAdded: number;
  totalLinesDeleted: number;
  commitFrequency: number; // commits per week
  averageCommitSize: number; // lines per commit
  churnRate: number; // volatility metric
}

/**
 * One file pair that historically changes together. `count` is the number of
 * in-window commits that touched both files (support); `coChangeRate` is
 * `count / min(timesA, timesB)` — the conditional co-change rate of the rarer
 * file (0–1). `a` and `b` are stored in ascending path order so the pair is
 * order-independent and the listing is deterministic.
 */
export interface CoChangePair {
  a: string;
  b: string;
  count: number;
  coChangeRate: number;
}

/**
 * Complete analytics report
 */
export interface GitAnalyticsReport {
  period: AnalyticsPeriod;
  generatedAt: Date;
  summary: AnalyticsSummary;
  commits: CommitMetric[];
  files: FileMetric[];
  authors: AuthorMetric[];
  trends: TrendData;
  commitFrequency: {
    labels: string[]; // ["Week 1", "Week 2", ...]
    data: number[];
  };
  churnFiles: FileMetric[]; // Top 10 by volatility
  topAuthors: AuthorMetric[]; // Top 5 by commits
  /**
   * File pairs that change together, ranked by support then co-change rate and
   * capped at CO_CHANGE.MAX_PAIRS. Optional for backward-compatibility across
   * the export paths and existing test fixtures; always populated (possibly
   * empty) by the analyzer, like `deadCode?` on the hygiene report.
   */
  coChange?: CoChangePair[];
}

/**
 * Options for running analysis
 */
export interface AnalyticsOptions {
  period: AnalyticsPeriod;
  author?: string; // Filter by author name
  pathPattern?: string; // Filter by file path pattern
}

/**
 * Webview message format
 */
export type AnalyticsWebviewMessageType = "init" | "filter" | "export" | "refresh";

export interface AnalyticsWebviewMessage {
  type: AnalyticsWebviewMessageType;
  payload?: {
    period?: AnalyticsPeriod;
    author?: string;
    pathPattern?: string;
    format?: "json" | "csv";
  };
}
