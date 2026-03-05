"use strict";
/**
 * Git Analytics Service — Parse git history and generate telemetry
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitAnalyzer = void 0;
const child_process_1 = require("child_process");
const micromatch_1 = __importDefault(require("micromatch"));
const constants_1 = require("../../constants");
const cache_1 = require("../../infrastructure/cache");
/** Glob patterns to exclude from file-level analytics (build artifacts, deps) */
const ANALYTICS_EXCLUDE = [
    ...constants_1.WORKSPACE_EXCLUDE_BASE,
    "**/out/**",
    "**/dist/**",
    "**/build/**",
    "**/*.lock",
    "**/package-lock.json",
];
class GitAnalyzer {
    constructor(workspaceRoot = process.cwd()) {
        this.workspaceRoot = workspaceRoot;
        this.cacheMap = new cache_1.TtlCache(constants_1.CACHE_SETTINGS.ANALYTICS_TTL_MS);
    }
    /**
     * Generate cache key from options
     */
    getCacheKey(opts) {
        const parts = [opts.period, opts.author || "all", opts.pathPattern || "all"];
        return parts.join("|");
    }
    /**
     * Main entry point: analyze git history over period
     */
    async analyze(opts) {
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
        const churnFiles = files.sort((a, b) => b.volatility - a.volatility).slice(0, constants_1.ANALYTICS_SETTINGS.TOP_CHURN_FILES_COUNT);
        // Top authors
        const topAuthors = authors
            .sort((a, b) => b.commits - a.commits)
            .slice(0, constants_1.ANALYTICS_SETTINGS.TOP_AUTHORS_COUNT);
        const report = {
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
    parseGitLog(since, until, opts) {
        try {
            const sinceStr = since.toISOString().split("T")[0];
            const untilStr = until.toISOString().split("T")[0];
            let cmd = `git log --since="${sinceStr}" --until="${untilStr}" --pretty=format:"%H|%an|%ai|%s" --numstat`;
            // Filter by author if specified
            if (opts.author) {
                cmd += ` --author="${opts.author}"`;
            }
            const output = (0, child_process_1.execSync)(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"], cwd: this.workspaceRoot });
            const commits = [];
            let currentCommit = null;
            const commitLines = new Map();
            // Parse output line by line
            for (const line of output.split("\n")) {
                if (!line.trim())
                    continue;
                // Commit header line: hash|author|date|message
                if (line.includes("|")) {
                    // Save previous commit if exists
                    if (currentCommit && currentCommit.hash) {
                        const filesLines = commitLines.get(currentCommit.hash) || [];
                        this.aggregateCommitFiles(currentCommit, filesLines);
                        if (opts.pathPattern !== undefined) {
                            this.applyPathFilter(currentCommit, opts.pathPattern);
                        }
                        if (opts.pathPattern === undefined || this.matchesPathPattern(currentCommit, opts.pathPattern)) {
                            commits.push(currentCommit);
                        }
                    }
                    const parts = line.split("|");
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
                }
                else if (currentCommit && currentCommit.hash) {
                    // File change line: "insertions\tdeletions\tpath"
                    const lines = commitLines.get(currentCommit.hash) || [];
                    lines.push(line);
                    commitLines.set(currentCommit.hash, lines);
                }
            }
            // Process last commit
            if (currentCommit && currentCommit.hash) {
                const filesLines = commitLines.get(currentCommit.hash) || [];
                this.aggregateCommitFiles(currentCommit, filesLines);
                if (opts.pathPattern !== undefined) {
                    this.applyPathFilter(currentCommit, opts.pathPattern);
                }
                if (opts.pathPattern === undefined || this.matchesPathPattern(currentCommit, opts.pathPattern)) {
                    commits.push(currentCommit);
                }
            }
            return commits;
        }
        catch (err) {
            // Return empty if git command fails (e.g., no commits in range)
            return [];
        }
    }
    /**
     * Process numstat lines for a commit
     */
    aggregateCommitFiles(commit, lines) {
        const files = [];
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
                if (path) {
                    files.push({ path, insertions, deletions });
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
    applyPathFilter(commit, pattern) {
        const matched = commit.files.filter(f => micromatch_1.default.isMatch(f.path, pattern));
        commit.files = matched;
        commit.filesChanged = matched.length;
        commit.insertions = matched.reduce((s, f) => s + f.insertions, 0);
        commit.deletions = matched.reduce((s, f) => s + f.deletions, 0);
    }
    /**
     * Check if commit matches path pattern filter
     */
    matchesPathPattern(commit, pattern) {
        return commit.files.some((f) => micromatch_1.default.isMatch(f.path, pattern));
    }
    /**
     * Aggregate file-level statistics
     */
    aggregateFiles(commits) {
        const fileMap = new Map();
        for (const commit of commits) {
            for (const fileChange of commit.files) {
                const { path, insertions, deletions } = fileChange;
                // Skip build artifacts and ignored directories
                if (micromatch_1.default.isMatch(path, ANALYTICS_EXCLUDE)) {
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
                const metric = fileMap.get(path);
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
            if (metric.volatility > constants_1.ANALYTICS_SETTINGS.RISK_HIGH_VOLATILITY) {
                metric.risk = "high";
            }
            else if (metric.volatility > constants_1.ANALYTICS_SETTINGS.RISK_MEDIUM_VOLATILITY) {
                metric.risk = "medium";
            }
            else {
                metric.risk = "low";
            }
        }
        return Array.from(fileMap.values()).sort((a, b) => b.volatility - a.volatility);
    }
    /**
     * Aggregate author-level statistics
     */
    aggregateAuthors(commits) {
        const authorMap = new Map();
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
            const metric = authorMap.get(commit.author);
            metric.commits++;
            metric.insertions += commit.insertions;
            metric.deletions += commit.deletions;
            metric.filesChanged += commit.filesChanged;
            if (commit.date > metric.lastActive) {
                metric.lastActive = commit.date;
            }
        }
        return Array.from(authorMap.values()).sort((a, b) => b.commits - a.commits);
    }
    /**
     * Calculate trend metrics, normalized by actual period length.
     */
    calculateTrends(commits, _since) {
        const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
        const mid = Math.floor(commits.length / 2);
        const firstHalf = commits.slice(0, mid); // recent (git log: newest first)
        const secondHalf = commits.slice(mid); // older
        // Normalize each half by its own actual time span so density is comparable
        const spanWeeks = (half) => {
            if (half.length < 2)
                return 1;
            const ms = Math.abs(half[0].date.getTime() - half[half.length - 1].date.getTime());
            return Math.max(1, ms / WEEK_MS);
        };
        const firstAvg = firstHalf.length / spanWeeks(firstHalf);
        const secondAvg = secondHalf.length / spanWeeks(secondHalf);
        // recent − older: positive = increasing activity = "up"
        const commitSlope = firstAvg - secondAvg;
        const volatilitySlope = this.getAverageVolatility(firstHalf) - this.getAverageVolatility(secondHalf);
        return {
            commitTrend: {
                slope: commitSlope,
                direction: this.getDirection(commitSlope),
                confidence: constants_1.ANALYTICS_SETTINGS.TREND_CONFIDENCE,
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
    getDirection(slope) {
        if (slope > constants_1.ANALYTICS_SETTINGS.TREND_SLOPE_THRESHOLD)
            return "up";
        if (slope < -constants_1.ANALYTICS_SETTINGS.TREND_SLOPE_THRESHOLD)
            return "down";
        return "stable";
    }
    /**
     * Calculate average volatility for a set of commits
     */
    getAverageVolatility(commits) {
        if (commits.length === 0)
            return 0;
        const total = commits.reduce((sum, c) => sum + (c.insertions + c.deletions), 0);
        return total / commits.length;
    }
    /**
     * Build summary statistics
     */
    buildSummary(commits, files, authors, since, until) {
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
            averageCommitSize: commits.length > 0
                ? (totalInsertions + totalDeletions) / commits.length
                : 0,
            churnRate: files.reduce((sum, f) => sum + f.volatility, 0) / files.length || 0,
        };
    }
    /**
     * Build commit frequency time series data
     */
    buildCommitFrequency(commits) {
        // Group commits by week
        const weekMap = new Map();
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
    getWeekKey(date) {
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
    getPeriodStartDate(period) {
        const now = new Date();
        const months = period === "3mo" ? 3 : period === "6mo" ? 6 : 12;
        return new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.cacheMap.clear();
    }
    /**
     * Export analytics to JSON
     */
    exportToJSON(report) {
        return JSON.stringify(report, (_key, value) => {
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value;
        }, 2);
    }
    /**
     * Export analytics to CSV
     */
    exportToCSV(report) {
        // Escape double-quotes in CSV string fields per RFC 4180
        const csvStr = (value) => `"${value.replace(/"/g, '""')}"`;
        const lines = [];
        // Summary section
        lines.push("Git Analytics Report");
        lines.push(`Period,${report.period}`);
        lines.push(`Generated,${report.generatedAt.toISOString()}`);
        lines.push("");
        // Summary stats
        lines.push("Summary");
        lines.push(`Total Commits,Total Authors,Total Files Modified,Lines Added,Lines Deleted,Commit Frequency (per week),Avg Commit Size,Churn Rate`);
        const sum = report.summary;
        lines.push(`${sum.totalCommits},${sum.totalAuthors},${sum.totalFilesModified},${sum.totalLinesAdded},${sum.totalLinesDeleted},${sum.commitFrequency.toFixed(2)},${sum.averageCommitSize.toFixed(2)},${sum.churnRate.toFixed(2)}`);
        lines.push("");
        // Files section
        lines.push("Files");
        lines.push("Path,Commits,Insertions,Deletions,Volatility,Risk,Authors,Last Modified");
        for (const file of report.files.slice(0, constants_1.ANALYTICS_SETTINGS.CSV_MAX_FILES)) {
            lines.push(`${csvStr(file.path)},${file.commitCount},${file.insertions},${file.deletions},${file.volatility.toFixed(2)},${file.risk},${csvStr(file.authors.join(";"))},${file.lastModified.toISOString()}`);
        }
        lines.push("");
        // Authors section
        lines.push("Authors");
        lines.push("Name,Commits,Insertions,Deletions,Files Changed,Last Active");
        for (const author of report.authors) {
            lines.push(`${csvStr(author.name)},${author.commits},${author.insertions},${author.deletions},${author.filesChanged},${author.lastActive.toISOString()}`);
        }
        return lines.join("\n");
    }
}
exports.GitAnalyzer = GitAnalyzer;
//# sourceMappingURL=analytics-service.js.map