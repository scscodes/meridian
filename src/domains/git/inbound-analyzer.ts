/**
 * Inbound Changes Analyzer — Detect Conflicts with Remote Branch
 * Isolated, testable business logic with robust error handling.
 *
 * ✓ All GitProvider calls wrapped in Result<T> checks
 * ✓ Null/undefined guards before property access
 * ✓ Try-catch for async operations with proper error context
 * ✓ Graceful degradation (cache miss fallback)
 */

import {
  GitProvider,
  Logger,
  Result,
  failure,
  success,
} from "../../types";
import {
  InboundChanges,
  ConflictFile,
  ChangesSummary,
} from "./types";
import { GIT_ERROR_CODES } from "../../infrastructure/error-codes";

// ============================================================================
// Inbound Changes Analyzer — Detect Conflicts with Remote Branch
// ============================================================================

export class InboundAnalyzer {
  private gitProvider: GitProvider;
  private logger: Logger;

  constructor(gitProvider: GitProvider, logger: Logger) {
    this.gitProvider = gitProvider;
    this.logger = logger;
  }

  /**
   * Analyze incoming changes from remote without pulling.
   * Detects conflicts between local and remote changes.
   * Validates all inputs and handles errors gracefully.
   */
  async analyze(): Promise<Result<InboundChanges>> {
    try {
      // 1. Fetch from remote (non-destructive)
      this.logger.info("Fetching from remote...", "InboundAnalyzer");
      const fetchResult = await this.gitProvider.fetch("origin");
      if (fetchResult.kind === "err") {
        return fetchResult;
      }

      // 2. Get current branch
      const branchResult = await this.gitProvider.getCurrentBranch();
      if (branchResult.kind === "err") {
        return branchResult;
      }

      const branch = branchResult.value;
      // Guard: validate branch is not empty
      if (!branch || typeof branch !== "string") {
        return failure({
          code: GIT_ERROR_CODES.INBOUND_ANALYSIS_ERROR,
          message: "Invalid branch name from git provider",
          context: "InboundAnalyzer.analyze",
        });
      }

      const upstream = `origin/${branch}`;

      // 3. Get inbound changes (name-status format: "<status>\t<path>" per line)
      const inboundDiffResult = await this.gitProvider.diff(`HEAD..${upstream}`, ["--name-status"]);
      if (inboundDiffResult.kind === "err") {
        return inboundDiffResult;
      }

      const inboundDiff = inboundDiffResult.value;
      // Guard: validate inboundDiff
      if (inboundDiff === null || inboundDiff === undefined) {
        return failure({
          code: GIT_ERROR_CODES.INBOUND_DIFF_PARSE_ERROR,
          message: "Git provider returned null diff",
          context: "InboundAnalyzer.analyze",
        });
      }

      // If no inbound changes, return early
      if (inboundDiff.trim() === "") {
        return success({
          remote: "origin",
          branch,
          totalInbound: 0,
          totalLocal: 0,
          conflicts: [],
          summary: {
            description: "Remote branch is up-to-date",
            conflicts: { high: 0, medium: 0, low: 0 },
            fileTypes: {},
            recommendations: ["✅ No remote changes detected. Fully synced."],
          },
          diffLink: `View with: git diff HEAD..origin/${branch}`,
        });
      }

      // 4. Get local changes via structured API (returns GitFileChange[] with status codes)
      const localChangesResult = await this.gitProvider.getAllChanges();
      if (localChangesResult.kind === "err") {
        return localChangesResult;
      }

      // 5. Parse inbound diff (name-status format) and convert local changes to map
      const inboundChanges = this.parseGitDiff(inboundDiff || "");
      const localChanges = new Map<string, string>(
        localChangesResult.value.map((c) => [c.path, c.status])
      );

      // Guard: validate parsed changes
      if (!inboundChanges || inboundChanges.size === 0) {
        this.logger.warn(
          "No inbound changes parsed from diff",
          "InboundAnalyzer.analyze"
        );
      }

      // 6. Detect conflicts
      const conflicts = await this.detectConflicts(
        inboundChanges,
        localChanges,
        branch
      );

      // 7. Summarize
      const summary = this.summarize(inboundChanges, localChanges, conflicts);

      // 8. Generate diff link
      const diffLinkResult = await this.gitProvider.getRemoteUrl("origin");
      let diffLink = `View with: git diff HEAD..origin/${branch}`;
      if (diffLinkResult.kind === "ok" && diffLinkResult.value) {
        try {
          diffLink = this.generateDiffLink(diffLinkResult.value, branch);
        } catch (err) {
          this.logger.warn(
            "Failed to generate diff link; using fallback",
            "InboundAnalyzer.analyze"
          );
          // Continue with fallback diffLink
        }
      }

      return success({
        remote: "origin",
        branch,
        totalInbound: inboundChanges.size,
        totalLocal: localChanges.size,
        conflicts,
        summary,
        diffLink,
      });
    } catch (err) {
      return failure({
        code: GIT_ERROR_CODES.INBOUND_ANALYSIS_ERROR,
        message:
          "Failed to analyze inbound changes; check git is installed with: git --version",
        details: err,
        context: "InboundAnalyzer.analyze",
      });
    }
  }

  /**
   * Parse git diff output into a map of path -> status
   * Validates input and handles malformed output gracefully
   */
  private parseGitDiff(diffOutput: string): Map<string, string> {
    const changes = new Map<string, string>();

    // Guard: null/undefined check
    if (!diffOutput || typeof diffOutput !== "string") {
      this.logger.warn(
        "parseGitDiff received invalid input; returning empty map",
        "InboundAnalyzer.parseGitDiff"
      );
      return changes;
    }

    try {
      const lines = diffOutput.trim().split("\n");

      for (const line of lines) {
        if (!line || !line.trim()) continue;

        const parts = line.split(/\s+/);
        if (parts.length < 2) {
          this.logger.debug(
            `Skipping malformed diff line: ${line}`,
            "InboundAnalyzer.parseGitDiff"
          );
          continue;
        }

        // Normalize status: R100 -> R, C100 -> C, etc.
        const rawStatus = parts[0];
        const status = rawStatus.charAt(0);
        // For renames, git outputs: R<score>\t<old-path>\t<new-path>; use new path
        const path = rawStatus.startsWith("R") && parts.length >= 3
          ? parts[2]
          : parts.slice(1).join(" ");

        // Validate path is not empty after parsing
        if (!path || !status) {
          this.logger.debug(
            "Skipping line with empty status or path",
            "InboundAnalyzer.parseGitDiff"
          );
          continue;
        }

        changes.set(path, status);
      }

      return changes;
    } catch (err) {
      this.logger.error(
        "Failed to parse git diff output",
        "InboundAnalyzer.parseGitDiff",
        {
          code: GIT_ERROR_CODES.INBOUND_DIFF_PARSE_ERROR,
          message: "Git diff parsing failed; returning empty map",
          details: err,
        }
      );
      return changes; // Return empty map on parse failure
    }
  }

  /**
   * Detect conflicts between inbound and local changes
   * Guards against null/undefined and errors in sub-operations
   */
  private async detectConflicts(
    inbound: Map<string, string>,
    local: Map<string, string>,
    branch: string
  ): Promise<ConflictFile[]> {
    const conflicts: ConflictFile[] = [];

    // Guard: validate inputs
    if (!inbound || !local) {
      this.logger.warn(
        "detectConflicts: invalid input maps; returning empty conflicts",
        "InboundAnalyzer.detectConflicts"
      );
      return conflicts;
    }

    if (!branch || typeof branch !== "string") {
      this.logger.warn(
        "detectConflicts: invalid branch; returning empty conflicts",
        "InboundAnalyzer.detectConflicts"
      );
      return conflicts;
    }

    try {
      for (const [path, remoteStatus] of inbound) {
        if (!path || !remoteStatus) continue;

        if (local.has(path)) {
          const localStatus = local.get(path);

          // Guard: ensure localStatus is not undefined
          if (!localStatus) {
            this.logger.debug(
              `Skipping ${path}: empty local status`,
              "InboundAnalyzer.detectConflicts"
            );
            continue;
          }

          // Conflict: both sides modified same file
          if (localStatus === "M" && remoteStatus === "M") {
            const localChanges = await this.estimateChanges(path, "HEAD");
            const remoteChanges = await this.estimateChanges(
              path,
              `origin/${branch}`
            );

            conflicts.push({
              path,
              localStatus: "M",
              remoteStatus: "M",
              severity: "high",
              localChanges,
              remoteChanges,
            });
          }
          // Conflict: we modified, they deleted
          else if (localStatus === "M" && remoteStatus === "D") {
            const localChanges = await this.estimateChanges(path, "HEAD");

            conflicts.push({
              path,
              localStatus: "M",
              remoteStatus: "D",
              severity: "high",
              localChanges,
              remoteChanges: 0,
            });
          }
          // Conflict: we deleted, they modified
          else if (localStatus === "D" && remoteStatus === "M") {
            const remoteChanges = await this.estimateChanges(
              path,
              `origin/${branch}`
            );

            conflicts.push({
              path,
              localStatus: "D",
              remoteStatus: "M",
              severity: "high",
              localChanges: 0,
              remoteChanges,
            });
          }
          // Low severity: both added (could have same content)
          else if (localStatus === "A" && remoteStatus === "A") {
            const localChanges = await this.estimateChanges(path, "HEAD");
            const remoteChanges = await this.estimateChanges(
              path,
              `origin/${branch}`
            );

            conflicts.push({
              path,
              localStatus: "A",
              remoteStatus: "A",
              severity: "medium",
              localChanges,
              remoteChanges,
            });
          }
        }
      }

      return conflicts;
    } catch (err) {
      this.logger.error(
        "Error during conflict detection",
        "InboundAnalyzer.detectConflicts",
        {
          code: GIT_ERROR_CODES.CONFLICT_DETECTION_ERROR,
          message: "Failed to detect conflicts",
          details: err,
        }
      );
      return conflicts; // Return conflicts found so far on error
    }
  }

  /**
   * Count actual line changes for a file at a given ref using git diff --numstat.
   */
  private async estimateChanges(path: string, ref: string): Promise<number> {
    if (!path || !ref) {
      return 0;
    }
    const result = await this.gitProvider.diff(ref, ["--numstat", "--", path]);
    if (result.kind === "err") return 0;
    const match = result.value.trim().match(/^(\d+)\s+(\d+)/);
    if (!match) return 0;
    return parseInt(match[1] ?? "0", 10) + parseInt(match[2] ?? "0", 10);
  }

  /**
   * Summarize changes with recommendations
   * Guards against null/undefined inputs
   */
  private summarize(
    inbound: Map<string, string>,
    _local: Map<string, string>,
    conflicts: ConflictFile[]
  ): ChangesSummary {
    try {
      // Guard: validate inputs
      if (!inbound || !(inbound instanceof Map)) {
        this.logger.warn(
          "summarize: invalid inbound map; returning empty summary",
          "InboundAnalyzer.summarize"
        );
        return {
          description: "Unable to summarize changes",
          conflicts: { high: 0, medium: 0, low: 0 },
          fileTypes: {},
          recommendations: ["⚠️ Summary generation failed"],
        };
      }

      if (!conflicts || !Array.isArray(conflicts)) {
        this.logger.warn(
          "summarize: invalid conflicts array; using empty array",
          "InboundAnalyzer.summarize"
        );
        conflicts = [];
      }

      const highSeverity = conflicts.filter((c) => c?.severity === "high")
        .length;
      const mediumSeverity = conflicts.filter((c) => c?.severity === "medium")
        .length;
      const lowSeverity = conflicts.filter((c) => c?.severity === "low").length;

      // Group by file type
      const fileTypes: Record<string, number> = {};
      for (const [path] of inbound) {
        if (!path || typeof path !== "string") continue;

        const ext = path.split(".").pop() || "unknown";
        const key = `.${ext}`;
        fileTypes[key] = (fileTypes[key] ?? 0) + 1;
      }

      // Generate recommendations
      const recommendations = this.recommendations(conflicts);

      const description =
        conflicts.length === 0
          ? `0 conflicts in ${inbound.size} inbound change${inbound.size !== 1 ? "s" : ""}`
          : `${conflicts.length} potential conflict${conflicts.length !== 1 ? "s" : ""} in ${inbound.size} inbound change${inbound.size !== 1 ? "s" : ""}`;

      return {
        description,
        conflicts: { high: highSeverity, medium: mediumSeverity, low: lowSeverity },
        fileTypes,
        recommendations,
      };
    } catch (err) {
      this.logger.error(
        "Error during summary generation",
        "InboundAnalyzer.summarize",
        {
          code: GIT_ERROR_CODES.INBOUND_ANALYSIS_ERROR,
          message: "Failed to summarize changes",
          details: err,
        }
      );

      return {
        description: "Unable to summarize changes",
        conflicts: { high: 0, medium: 0, low: 0 },
        fileTypes: {},
        recommendations: ["⚠️ Summary generation failed"],
      };
    }
  }

  /**
   * Generate recommendations based on conflicts
   */
  private recommendations(conflicts: ConflictFile[]): string[] {
    const recs: string[] = [];

    const highConflicts = conflicts.filter((c) => c.severity === "high");
    if (highConflicts.length > 0) {
      recs.push(
        `⚠️  Review ${highConflicts.length} high-severity conflict${highConflicts.length !== 1 ? "s" : ""}`
      );
      highConflicts.slice(0, 3).forEach((c) => {
        const action =
          c.localStatus === "D"
            ? "deleted"
            : c.localStatus === "A"
              ? "added"
              : "modified";
        recs.push(`  • You ${action} ${c.path}, remote changed it`);
      });
    }

    const mediumConflicts = conflicts.filter((c) => c.severity === "medium");
    if (mediumConflicts.length > 0) {
      recs.push(
        `📋 Both sides added ${mediumConflicts.length} file${mediumConflicts.length !== 1 ? "s" : ""}`
      );
    }

    if (conflicts.length === 0) {
      recs.push("✅ No conflicts detected. Safe to pull.");
    }

    return recs;
  }

  /**
   * Generate a diff link for the remote changes
   * Handles various git hosting platforms and falls back gracefully
   */
  private generateDiffLink(remoteUrl: string, branch: string): string {
    try {
      // Guard: validate inputs
      if (!remoteUrl || typeof remoteUrl !== "string") {
        throw new Error("Invalid remote URL");
      }

      if (!branch || typeof branch !== "string") {
        throw new Error("Invalid branch name");
      }

      // GitHub: https://github.com/owner/repo/compare/main...origin/main
      if (remoteUrl.includes("github.com")) {
        const match = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/);
        if (match && match[1] && match[2]) {
          const owner = match[1].trim();
          const repo = match[2].trim();
          return `https://github.com/${owner}/${repo}/compare/${branch}...origin/${branch}`;
        }
      }

      // GitLab: https://gitlab.com/owner/repo/-/compare/main...origin/main
      if (remoteUrl.includes("gitlab.com")) {
        const match = remoteUrl.match(/gitlab\.com[:/](.+?)\/(.+?)(?:\.git)?$/);
        if (match && match[1] && match[2]) {
          const owner = match[1].trim();
          const repo = match[2].trim();
          return `https://gitlab.com/${owner}/${repo}/-/compare/${branch}...origin/${branch}`;
        }
      }

      // Bitbucket pattern (simplified)
      if (remoteUrl.includes("bitbucket")) {
        const match = remoteUrl.match(/bitbucket\.org[:/](.+?)\/(.+?)(?:\.git)?$/);
        if (match && match[1] && match[2]) {
          const owner = match[1].trim();
          const repo = match[2].trim();
          return `https://bitbucket.org/${owner}/${repo}/compare/${branch}...origin/${branch}`;
        }
      }

      // Fallback: generic git diff command
      return `View with: git diff HEAD..origin/${branch}`;
    } catch (err) {
      this.logger.warn(
        `Failed to generate diff link for ${remoteUrl}; using fallback`,
        "InboundAnalyzer.generateDiffLink"
      );
      return `View with: git diff HEAD..origin/${branch || "HEAD"}`;
    }
  }
}
