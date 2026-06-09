/**
 * Git Domain Service — DDD-style domain service.
 * Isolated, testable business logic with robust error handling.
 *
 * ✓ All GitProvider calls wrapped in Result<T> checks
 * ✓ Null/undefined guards before property access
 * ✓ Try-catch for async operations with proper error context
 * ✓ Graceful degradation (cache miss fallback)
 */

import {
  DomainService,
  GitCommandName,
  Handler,
  Logger,
  GitProvider,
  Result,
  failure,
  success,
  GenerateProseFn,
} from "../../types";
import { RunLog } from "../../infrastructure/run-log";
import {
  createStatusHandler,
  createPullHandler,
  createCommitHandler,
} from "./handlers";
import { createSessionBriefingHandler } from "./session-handler";
import { SessionBriefingSources, HygieneScanGetter } from "./session-aggregator";
import { createShowAnalyticsHandler } from "./analytics-handler";
import { GitAnalyzer } from "./analytics-service";

// ============================================================================
// Git domain commands.
// ============================================================================

export const GIT_COMMANDS: GitCommandName[] = [
  "git.status",
  "git.pull",
  "git.commit",
  "git.showAnalytics",
  "git.sessionBriefing",
];

export class GitDomainService implements DomainService {
  readonly name = "git";

  handlers: Partial<Record<GitCommandName, Handler<any, any>>> = {};
  private gitProvider: GitProvider;
  private logger: Logger;

  // Analytics component
  public analyzer: GitAnalyzer;

  private readonly runLog: RunLog | undefined;
  private readonly getHygieneScan: HygieneScanGetter | undefined;

  constructor(
    gitProvider: GitProvider,
    logger: Logger,
    workspaceRoot: string = process.cwd(),
    generateProseFn?: GenerateProseFn,
    runLog?: RunLog,
    getHygieneScan?: HygieneScanGetter
  ) {
    this.gitProvider = gitProvider;
    this.logger = logger;
    this.runLog = runLog;
    this.getHygieneScan = getHygieneScan;

    // Initialize analytics — pass workspace root so git log runs in the correct repo
    this.analyzer = new GitAnalyzer(workspaceRoot);

    // Initialize handlers
    this.handlers = {
      "git.status": createStatusHandler(gitProvider, logger),
      "git.pull": createPullHandler(gitProvider, logger),
      "git.commit": createCommitHandler(gitProvider, logger),
      "git.showAnalytics": createShowAnalyticsHandler(this.analyzer, logger),
      // Always registered: prose is optional and the handler degrades to a
      // deterministic summary when generateProseFn is absent (ADR 012).
      "git.sessionBriefing": createSessionBriefingHandler(
        {
          gitProvider,
          runLog: this.runLog,
          gitAnalyzer: this.analyzer,
          getHygieneScan: this.getHygieneScan,
          logger,
        } satisfies SessionBriefingSources,
        generateProseFn
      ),
    };
  }

  /**
   * Initialize domain — verify git is available, check repo state.
   */
  async initialize(): Promise<Result<void>> {
    try {
      this.logger.info(
        "Initializing git domain",
        "GitDomainService.initialize"
      );

      // Check git availability by executing git status
      const statusResult = await this.gitProvider.status();
      if (statusResult.kind === "err") {
        return failure({
          code: "GIT_UNAVAILABLE",
          message: "Git is not available or not initialized",
          details: statusResult.error,
          context: "GitDomainService.initialize",
        });
      }

      this.logger.info(
        `Git initialized (branch: ${statusResult.value.branch})`,
        "GitDomainService.initialize"
      );
      return success(void 0);
    } catch (err) {
      return failure({
        code: "GIT_INIT_ERROR",
        message: "Failed to initialize git domain",
        details: err,
        context: "GitDomainService.initialize",
      });
    }
  }

  /**
   * Cleanup — no resources to release, but log completion.
   */
  async teardown(): Promise<void> {
    this.logger.debug("Tearing down git domain", "GitDomainService.teardown");
  }
}

/**
 * Factory function — creates and returns git domain service.
 */
export function createGitDomain(
  gitProvider: GitProvider,
  logger: Logger,
  workspaceRoot: string = process.cwd(),
  generateProseFn?: GenerateProseFn,
  runLog?: RunLog,
  getHygieneScan?: HygieneScanGetter
): GitDomainService {
  return new GitDomainService(gitProvider, logger, workspaceRoot, generateProseFn, runLog, getHygieneScan);
}
