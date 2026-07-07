/**
 * Git Analytics Service — Parse git history and generate telemetry
 */

import { execFileSync } from "child_process";
import {
  AnalyticsPeriod,
  AnalyticsOptions,
  AnalyticsSummary,
  AuthorMetric,
  CommitMetric,
  CommitFileChange,
  CoChangePair,
  FileMetric,
  GitAnalyticsReport,
  TrendData,
} from "./analytics-types";
import { ANALYTICS_SETTINGS, CACHE_SETTINGS, CO_CHANGE, WORKSPACE_EXCLUDE_BASE } from "../../constants";
import { REPORT_LABELS, reportCsvHeader, reportMdHeader, mdEscape } from "../../report-labels";
import { normalizeRenamePath } from "./git-path";
import { TtlCache } from "../../infrastructure/cache";
import { pathMatchesAny } from "../../infrastructure/glob-match";
import { ignoreFileMtimeMs, readMeridianIgnorePatterns } from "../../security/ignore-store";

/** Baseline glob patterns excluded from file-level analytics (build artifacts, deps). */
const ANALYTICS_EXCLUDE_BASE = [
  ...WORKSPACE_EXCLUDE_BASE,
  "**/out/**",
  "**/dist/**",
  "**/build/**",
  "**/*.lock",
  "**/package-lock.json",
];

export class GitAnalyzer {
  private cacheMap = new TtlCache<string, GitAnalyticsReport>(CACHE_SETTINGS.ANALYTICS_TTL_MS);

  constructor(private readonly workspaceRoot: string = process.cwd()) {}

  /**
   * Generate cache key from options. Folds in the .meridian/.meridianignore
   * mtime so an edit to the ignore file (e.g. from a webview "Ignore" action)
   * invalidates stale entries without an explicit clearCache() handoff.
   */
  private getCacheKey(opts: AnalyticsOptions): string {
    const parts = [
      opts.period,
      opts.author || "all",
      opts.pathPattern || "all",
      `ignore=${ignoreFileMtimeMs(this.workspaceRoot)}`,
    ];
    return parts.join("|");
  }

  /** Patterns to exclude from file-level analytics — baseline + user .meridian/.meridianignore. */
  private getExcludePatterns(): string[] {
    return [...ANALYTICS_EXCLUDE_BASE, ...readMeridianIgnorePatterns(this.workspaceRoot)];
  }

  /**
   * Main entry point: analyze git history over period
   */
  async analyze(opts: AnalyticsOptions): Promise<GitAnalyticsReport> {
    const cacheKey = this.getCacheKey(opts);

    // Check cache
    const cached = this.cacheMap.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Calculate date range
    const since = this.getPeriodStartDate(opts.period);
    const until = new Date();

    // Parse git log
    const commits = this.parseGitLog(since, until, opts);

    // Aggregate metrics
    const files = this.aggregateFiles(commits);
    const authors = this.aggregateAuthors(commits);

    // Calculate trends
    const trends = this.calculateTrends(commits, since);

    // Build summary
    const summary = this.buildSummary(commits, files, authors, since, until);

    // Build frequency data
    const commitFrequency = this.buildCommitFrequency(commits);

    // Top churn files
    const churnFiles = files.sort((a, b) => b.volatility - a.volatility).slice(0, ANALYTICS_SETTINGS.TOP_CHURN_FILES_COUNT);

    // Top authors
    const topAuthors = authors
      .sort((a, b) => b.commits - a.commits)
      .slice(0, ANALYTICS_SETTINGS.TOP_AUTHORS_COUNT);

    // Change companions (co-change pairs)
    const coChange = this.computeCoChange(commits);

    const report: GitAnalyticsReport = {
      period: opts.period,
      generatedAt: new Date(),
      summary,
      commits,
      files,
      authors,
      trends,
      commitFrequency,
      churnFiles,
      topAuthors,
      coChange,
    };

    // Cache result
    this.cacheMap.set(cacheKey, report);

    return report;
  }

  /**
   * Parse git log with numstat format
   * Format: git log --pretty=format:"%H|%an|%ai|%s" --numstat
   * Output:
   *   hash|author|date|message
   *   5   3   src/file.ts
   *   2   1   src/other.ts
   */
  private parseGitLog(
    since: Date,
    until: Date,
    opts: AnalyticsOptions
  ): CommitMetric[] {
    try {
      const sinceStr = since.toISOString().split("T")[0];
      const untilStr = until.toISOString().split("T")[0];

      const args = [
        "log",
        `--since=${sinceStr}`,
        `--until=${untilStr}`,
        "--pretty=format:%H%x00%an%x00%ai%x00%s",
        "--numstat",
      ];

      // Filter by author if specified
      if (opts.author) {
        args.push(`--author=${this.escapeGitRegexLiteral(opts.author)}`);
      }

      const output = execFileSync("git", args, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "ignore"],
        cwd: this.workspaceRoot,
      });

      const commits: CommitMetric[] = [];
      let currentCommit: Partial<CommitMetric> | null = null;
      const commitLines = new Map<string, string[]>();

      // Parse output line by line
      for (const line of output.split("\n")) {
        if (!line.trim()) continue;

        // Commit header line: hash|author|date|message
        if (line.includes("\0")) {
          // Save previous commit if exists
          if (currentCommit && currentCommit.hash) {
            const filesLines = commitLines.get(currentCommit.hash) || [];
            this.aggregateCommitFiles(currentCommit as CommitMetric, filesLines);
            if (opts.pathPattern !== undefined) {
              this.applyPathFilter(currentCommit as CommitMetric, opts.pathPattern);
            }
            if (opts.pathPattern === undefined || this.matchesPathPattern(currentCommit as CommitMetric, opts.pathPattern)) {
              commits.push(currentCommit as CommitMetric);
            }
          }

          const parts = line.split("\0");
          if (parts.length >= 4) {
            currentCommit = {
              hash: parts[0],
              author: parts[1],
              date: new Date(parts[2]),
              message: parts[3],
              filesChanged: 0,
              insertions: 0,
              deletions: 0,
              files: [],
            };
            commitLines.set(parts[0], []);
          }
        } else if (currentCommit && currentCommit.hash) {
          // File change line: "insertions\tdeletions\tpath"
          const lines = commitLines.get(currentCommit.hash) || [];
          lines.push(line);
          commitLines.set(currentCommit.hash, lines);
        }
      }

      // Process last commit
      if (currentCommit && currentCommit.hash) {
        const filesLines = commitLines.get(currentCommit.hash) || [];
        this.aggregateCommitFiles(currentCommit as CommitMetric, filesLines);
        if (opts.pathPattern !== undefined) {
          this.applyPathFilter(currentCommit as CommitMetric, opts.pathPattern);
        }
        if (opts.pathPattern === undefined || this.matchesPathPattern(currentCommit as CommitMetric, opts.pathPattern)) {
          commits.push(currentCommit as CommitMetric);
        }
      }

      return commits;
    } catch (err) {
      // Return empty if git command fails (e.g., no commits in range)
      return [];
    }
  }

  private escapeGitRegexLiteral(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Process numstat lines for a commit
   */
  private aggregateCommitFiles(
    commit: CommitMetric,
    lines: string[]
  ): void {
    const files: CommitFileChange[] = [];
    let totalInsertions = 0;
    let totalDeletions = 0;

    for (const line of lines) {
      // numstat format: "<insertions>\t<deletions>\t<path>"
      // Binary files use "-" for insertions/deletions
      const parts = line.split("\t");
      if (parts.length >= 3) {
        const insertions = parseInt(parts[0]) || 0;
        const deletions = parseInt(parts[1]) || 0;
        const path = parts[2].trim();

        const normalizedPath = normalizeRenamePath(path);

        if (normalizedPath) {
          files.push({ path: normalizedPath, insertions, deletions });
          totalInsertions += insertions;
          totalDeletions += deletions;
        }
      }
    }

    commit.files = files;
    commit.filesChanged = files.length;
    commit.insertions = totalInsertions;
    commit.deletions = totalDeletions;
  }

  /**
   * Trim a commit's file list to only those matching pattern,
   * and recompute the derived insertion/deletion/filesChanged totals.
   * Must be called before matchesPathPattern().
   */
  private applyPathFilter(commit: CommitMetric, pattern: string): void {
    const matched = commit.files.filter(f => pathMatchesAny(f.path, pattern));
    commit.files        = matched;
    commit.filesChanged = matched.length;
    commit.insertions   = matched.reduce((s, f) => s + f.insertions, 0);
    commit.deletions    = matched.reduce((s, f) => s + f.deletions, 0);
  }

  /**
   * Check if commit matches path pattern filter
   */
  private matchesPathPattern(commit: CommitMetric, pattern: string): boolean {
    return commit.files.some((f) => pathMatchesAny(f.path, pattern));
  }

  /**
   * Aggregate file-level statistics
   */
  private aggregateFiles(commits: CommitMetric[]): FileMetric[] {
    const fileMap = new Map<string, FileMetric>();
    const excludePatterns = this.getExcludePatterns();

    for (const commit of commits) {
      for (const fileChange of commit.files) {
        const { path, insertions, deletions } = fileChange;

        // Skip build artifacts, deps, and user .meridian/.meridianignore patterns.
        if (pathMatchesAny(path, excludePatterns)) {
          continue;
        }

        if (!fileMap.has(path)) {
          fileMap.set(path, {
            path,
            commitCount: 0,
            insertions: 0,
            deletions: 0,
            volatility: 0,
            authors: [],
            lastModified: commit.date,
            risk: "low",
          });
        }

        const metric = fileMap.get(path)!;
        metric.commitCount++;
        metric.insertions += insertions;
        metric.deletions += deletions;
        if (!metric.authors.includes(commit.author)) {
          metric.authors.push(commit.author);
        }
        if (commit.date > metric.lastModified) {
          metric.lastModified = commit.date;
        }
      }
    }

    // Calculate volatility and risk
    for (const metric of fileMap.values()) {
      metric.volatility =
        metric.commitCount > 0
          ? (metric.insertions + metric.deletions) / metric.commitCount
          : 0;

      // Determine risk level
      if (metric.volatility > ANALYTICS_SETTINGS.RISK_HIGH_VOLATILITY) {
        metric.risk = "high";
      } else if (metric.volatility > ANALYTICS_SETTINGS.RISK_MEDIUM_VOLATILITY) {
        metric.risk = "medium";
      } else {
        metric.risk = "low";
      }
    }

    return Array.from(fileMap.values()).sort(
      (a, b) => b.volatility - a.volatility
    );
  }

  /**
   * Compute co-change pairs: files that change together in the same commit.
   * Pure over the already-parsed commits — no new I/O. Applies the same exclude
   * set as file-level analytics so build artifacts / lockfiles never dominate.
   * Commits touching more than CO_CHANGE.MAX_COMMIT_FILES files are skipped
   * (merges / sweeping renames are coupling noise and quadratic in pair count).
   * Pairs below CO_CHANGE.MIN_SUPPORT are dropped; the rest are ranked
   * support→rate→path and capped at CO_CHANGE.MAX_PAIRS.
   */
  private computeCoChange(commits: CommitMetric[]): CoChangePair[] {
    const excludePatterns = this.getExcludePatterns();
    const timesByFile = new Map<string, number>();
    // Pair key is "a\u0000b" with a < b so co-occurrence is order-independent.
    const pairCount = new Map<string, number>();

    for (const commit of commits) {
      // Unique, non-excluded paths in this commit (paths are already
      // rename-normalized by aggregateCommitFiles).
      const paths = Array.from(
        new Set(
          commit.files
            .map((f) => f.path)
            .filter((p) => p && !pathMatchesAny(p, excludePatterns))
        )
      );
      // Oversized commits are ignored entirely — they neither pair nor count
      // toward file-change totals, so a merge can't dilute a real pair's rate.
      if (paths.length > CO_CHANGE.MAX_COMMIT_FILES) continue;

      // Count every appearance (including solo commits): a focused change to a
      // file WITHOUT its companion correctly lowers their co-change rate.
      for (const p of paths) timesByFile.set(p, (timesByFile.get(p) || 0) + 1);

      if (paths.length < 2) continue; // counted above, but yields no pair

      paths.sort();
      for (let i = 0; i < paths.length; i++) {
        for (let j = i + 1; j < paths.length; j++) {
          const key = `${paths[i]}\u0000${paths[j]}`;
          pairCount.set(key, (pairCount.get(key) || 0) + 1);
        }
      }
    }

    const pairs: CoChangePair[] = [];
    for (const [key, count] of pairCount) {
      if (count < CO_CHANGE.MIN_SUPPORT) continue;
      const [a, b] = key.split("\u0000");
      const denom = Math.min(timesByFile.get(a) || count, timesByFile.get(b) || count);
      const coChangeRate = denom > 0 ? count / denom : 0;
      pairs.push({ a, b, count, coChangeRate });
    }

    pairs.sort(
      (x, y) =>
        y.count - x.count ||
        y.coChangeRate - x.coChangeRate ||
        (x.a < y.a ? -1 : x.a > y.a ? 1 : 0) ||
        (x.b < y.b ? -1 : x.b > y.b ? 1 : 0)
    );

    return pairs.slice(0, CO_CHANGE.MAX_PAIRS);
  }

  /**
   * Aggregate author-level statistics
   */
  private aggregateAuthors(commits: CommitMetric[]): AuthorMetric[] {
    const authorMap = new Map<string, AuthorMetric>();

    for (const commit of commits) {
      if (!authorMap.has(commit.author)) {
        authorMap.set(commit.author, {
          name: commit.author,
          commits: 0,
          insertions: 0,
          deletions: 0,
          filesChanged: 0,
          lastActive: commit.date,
        });
      }

      const metric = authorMap.get(commit.author)!;
      metric.commits++;
      metric.insertions += commit.insertions;
      metric.deletions += commit.deletions;
      metric.filesChanged += commit.filesChanged;
      if (commit.date > metric.lastActive) {
        metric.lastActive = commit.date;
      }
    }

    return Array.from(authorMap.values()).sort(
      (a, b) => b.commits - a.commits
    );
  }

  /**
   * Calculate trend metrics, normalized by actual period length.
   */
  private calculateTrends(commits: CommitMetric[], _since: Date): TrendData {
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const mid = Math.floor(commits.length / 2);
    const firstHalf  = commits.slice(0, mid);  // recent (git log: newest first)
    const secondHalf = commits.slice(mid);      // older

    // Normalize each half by its own actual time span so density is comparable
    const spanWeeks = (half: CommitMetric[]): number => {
      if (half.length < 2) return 1;
      const ms = Math.abs(half[0].date.getTime() - half[half.length - 1].date.getTime());
      return Math.max(1, ms / WEEK_MS);
    };

    const firstAvg  = firstHalf.length  / spanWeeks(firstHalf);
    const secondAvg = secondHalf.length / spanWeeks(secondHalf);

    // recent − older: positive = increasing activity = "up"
    const commitSlope     = firstAvg - secondAvg;
    const volatilitySlope = this.getAverageVolatility(firstHalf) - this.getAverageVolatility(secondHalf);

    return {
      commitTrend: {
        slope: commitSlope,
        direction: this.getDirection(commitSlope),
        confidence: ANALYTICS_SETTINGS.TREND_CONFIDENCE,
      },
      volatilityTrend: {
        slope: volatilitySlope,
        direction: this.getDirection(volatilitySlope),
      },
    };
  }

  /**
   * Get trend direction from slope
   */
  private getDirection(slope: number): "up" | "stable" | "down" {
    if (slope > ANALYTICS_SETTINGS.TREND_SLOPE_THRESHOLD) return "up";
    if (slope < -ANALYTICS_SETTINGS.TREND_SLOPE_THRESHOLD) return "down";
    return "stable";
  }

  /**
   * Calculate average volatility for a set of commits
   */
  private getAverageVolatility(commits: CommitMetric[]): number {
    if (commits.length === 0) return 0;
    const total = commits.reduce(
      (sum, c) => sum + (c.insertions + c.deletions),
      0
    );
    return total / commits.length;
  }

  /**
   * Build summary statistics
   */
  private buildSummary(
    commits: CommitMetric[],
    files: FileMetric[],
    authors: AuthorMetric[],
    since: Date,
    until: Date
  ): AnalyticsSummary {
    const weeksDiff = (until.getTime() - since.getTime()) / (7 * 24 * 60 * 60 * 1000);

    const totalInsertions = commits.reduce((sum, c) => sum + c.insertions, 0);
    const totalDeletions = commits.reduce((sum, c) => sum + c.deletions, 0);

    return {
      totalCommits: commits.length,
      totalAuthors: authors.length,
      totalFilesModified: files.length,
      totalLinesAdded: totalInsertions,
      totalLinesDeleted: totalDeletions,
      commitFrequency: weeksDiff > 0 ? commits.length / weeksDiff : 0,
      averageCommitSize:
        commits.length > 0
          ? (totalInsertions + totalDeletions) / commits.length
          : 0,
      churnRate: files.reduce((sum, f) => sum + f.volatility, 0) / files.length || 0,
    };
  }

  /**
   * Build commit frequency time series data
   */
  private buildCommitFrequency(
    commits: CommitMetric[]
  ): { labels: string[]; data: number[] } {
    // Group commits by week
    const weekMap = new Map<string, number>();

    for (const commit of commits) {
      const weekKey = this.getWeekKey(commit.date);
      weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + 1);
    }

    // Sort by date and create labels/data
    const sorted = Array.from(weekMap.entries()).sort();
    const labels = sorted.map(([key]) => key);
    const data = sorted.map(([, count]) => count);

    return { labels, data };
  }

  /**
   * Get ISO 8601 week key for grouping (YYYY-W##).
   * Avoids week-of-month fragmentation at month boundaries.
   */
  private getWeekKey(date: Date): string {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${week.toString().padStart(2, "0")}`;
  }

  /**
   * Get period start date
   */
  private getPeriodStartDate(period: AnalyticsPeriod): Date {
    const now = new Date();
    const months = period === "3mo" ? 3 : period === "6mo" ? 6 : 12;
    return new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cacheMap.clear();
  }
}

/**
 * Convert a git analytics report to CSV format.
 * Standalone so both the analyzer and webview provider can use it.
 */
export function gitReportToCsv(report: GitAnalyticsReport): string {
  const csvStr = (value: string): string => `"${value.replace(/"/g, '""')}"`;

  const lines: string[] = [];

  lines.push(reportCsvHeader(REPORT_LABELS.gitAnalytics));
  lines.push(`Period,${report.period}`);
  lines.push(`Generated,${report.generatedAt.toISOString()}`);
  lines.push("");

  lines.push("Summary");
  lines.push(
    `Total Commits,Total Authors,Total Files Modified,Lines Added,Lines Deleted,Commit Frequency (per week),Avg Commit Size,Churn Rate`
  );
  const sum = report.summary;
  lines.push(
    `${sum.totalCommits},${sum.totalAuthors},${sum.totalFilesModified},${sum.totalLinesAdded},${sum.totalLinesDeleted},${sum.commitFrequency.toFixed(2)},${sum.averageCommitSize.toFixed(2)},${sum.churnRate.toFixed(2)}`
  );
  lines.push("");

  lines.push("Files");
  lines.push(
    "Path,Commits,Insertions,Deletions,Volatility,Risk,Authors,Last Modified"
  );
  for (const file of report.files.slice(0, ANALYTICS_SETTINGS.CSV_MAX_FILES)) {
    lines.push(
      `${csvStr(file.path)},${file.commitCount},${file.insertions},${file.deletions},${file.volatility.toFixed(2)},${file.risk},${csvStr(file.authors.join(";"))},${file.lastModified.toISOString()}`
    );
  }
  lines.push("");

  lines.push("Authors");
  lines.push("Name,Commits,Insertions,Deletions,Files Changed,Last Active");
  for (const author of report.authors) {
    lines.push(
      `${csvStr(author.name)},${author.commits},${author.insertions},${author.deletions},${author.filesChanged},${author.lastActive.toISOString()}`
    );
  }

  const coChange = report.coChange ?? [];
  if (coChange.length > 0) {
    lines.push("");
    lines.push("Change Companions");
    lines.push("File A,File B,Co-Changes,Co-change %");
    for (const pair of coChange.slice(0, CO_CHANGE.CSV_MAX_PAIRS)) {
      lines.push(
        `${csvStr(pair.a)},${csvStr(pair.b)},${pair.count},${(pair.coChangeRate * 100).toFixed(0)}`
      );
    }
  }

  return lines.join("\n");
}

/**
 * Convert a git analytics report to Markdown. Mirrors gitReportToCsv's
 * section structure (same caps) so the two exports can never diverge in
 * coverage, only in framing.
 */
export function gitReportToMd(report: GitAnalyticsReport): string {
  const lines: string[] = [];

  lines.push(reportMdHeader(REPORT_LABELS.gitAnalytics));
  lines.push("");
  lines.push(`- **Period:** ${report.period}`);
  lines.push(`- **Generated:** ${report.generatedAt.toISOString()}`);
  lines.push("");

  const sum = report.summary;
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Total Commits | ${sum.totalCommits} |`);
  lines.push(`| Total Authors | ${sum.totalAuthors} |`);
  lines.push(`| Total Files Modified | ${sum.totalFilesModified} |`);
  lines.push(`| Lines Added | ${sum.totalLinesAdded} |`);
  lines.push(`| Lines Deleted | ${sum.totalLinesDeleted} |`);
  lines.push(`| Commit Frequency (per week) | ${sum.commitFrequency.toFixed(2)} |`);
  lines.push(`| Avg Commit Size | ${sum.averageCommitSize.toFixed(2)} |`);
  lines.push(`| Churn Rate | ${sum.churnRate.toFixed(2)} |`);
  lines.push("");

  lines.push("## Files");
  lines.push("");
  lines.push("| Path | Commits | Insertions | Deletions | Volatility | Risk | Authors | Last Modified |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const file of report.files.slice(0, ANALYTICS_SETTINGS.CSV_MAX_FILES)) {
    lines.push(
      `| ${mdEscape(file.path)} | ${file.commitCount} | ${file.insertions} | ${file.deletions} | ${file.volatility.toFixed(2)} | ${file.risk} | ${mdEscape(file.authors.join("; "))} | ${file.lastModified.toISOString()} |`
    );
  }
  lines.push("");

  lines.push("## Authors");
  lines.push("");
  lines.push("| Name | Commits | Insertions | Deletions | Files Changed | Last Active |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const author of report.authors) {
    lines.push(
      `| ${mdEscape(author.name)} | ${author.commits} | ${author.insertions} | ${author.deletions} | ${author.filesChanged} | ${author.lastActive.toISOString()} |`
    );
  }

  const coChange = report.coChange ?? [];
  if (coChange.length > 0) {
    lines.push("");
    lines.push("## Change Companions");
    lines.push("");
    lines.push("| File A | File B | Co-Changes | Co-change % |");
    lines.push("| --- | --- | --- | --- |");
    for (const pair of coChange.slice(0, CO_CHANGE.CSV_MAX_PAIRS)) {
      lines.push(
        `| ${mdEscape(pair.a)} | ${mdEscape(pair.b)} | ${pair.count} | ${(pair.coChangeRate * 100).toFixed(0)} |`
      );
    }
  }

  return lines.join("\n");
}
