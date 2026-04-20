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
} from "../../types";
import { RunLog } from "../../infrastructure/run-log";
import {
  createStatusHandler,
  createPullHandler,
  createCommitHandler,
} from "./handlers";
import { createSmartCommitHandler } from "./smart-commit-handler";
import { createAnalyzeInboundHandler } from "./inbound-handler";
import {
  createGeneratePRHandler,
  createReviewPRHandler,
  createCommentPRHandler,
  createResolveConflictsHandler,
} from "./pr-handlers";
import { GenerateProseFn } from "../../types";
import { createSessionBriefingHandler } from "./session-handler";
import { SessionBriefingSources, HygieneScanGetter } from "./session-aggregator";
import {
  createShowAnalyticsHandler,
  createExportJsonHandler,
  createExportCsvHandler,
} from "./analytics-handler";
import {
  ApprovalUI,
} from "./types";
import { ChangeGrouper, CommitMessageSuggester, BatchCommitter } from "./smart-commit-service";
import { InboundAnalyzer } from "./inbound-analyzer";
import { GitAnalyzer } from "./analytics-service";
// ============================================================================
// Git domain commands.
// ============================================================================

export const GIT_COMMANDS: GitCommandName[] = [
  "git.status",
  "git.pull",
  "git.commit",
  "git.smartCommit",
  "git.analyzeInbound",
  "git.generatePR",
  "git.reviewPR",
  "git.commentPR",
  "git.resolveConflicts",
];

export class GitDomainService implements DomainService {
  readonly name = "git";

  handlers: Partial<Record<GitCommandName, Handler<any, any>>> = {};
  private gitProvider: GitProvider;
  private logger: Logger;

  // Smart commit components
  public changeGrouper: ChangeGrouper;
  public messageSuggester: CommitMessageSuggester;
  public batchCommitter: BatchCommitter;

  // Inbound analysis component
  public inboundAnalyzer: InboundAnalyzer;

  // Analytics component
  public analyzer: GitAnalyzer;

  private readonly runLog: RunLog | undefined;
  private readonly getHygieneScan: HygieneScanGetter | undefined;

  constructor(
    gitProvider: GitProvider,
    logger: Logger,
    workspaceRoot: string = process.cwd(),
    approvalUI?: ApprovalUI,
    generateProseFn?: GenerateProseFn,
    runLog?: RunLog,
    getHygieneScan?: HygieneScanGetter
  ) {
    this.gitProvider = gitProvider;
    this.logger = logger;
    this.runLog = runLog;
    this.getHygieneScan = getHygieneScan;

    // Initialize smart commit components
    this.changeGrouper = new ChangeGrouper();
    this.messageSuggester = new CommitMessageSuggester();
    this.batchCommitter = new BatchCommitter(gitProvider, logger);

    // Initialize inbound analyzer
    this.inboundAnalyzer = new InboundAnalyzer(gitProvider, logger);

    // Initialize analytics — pass workspace root so git log runs in the correct repo
    this.analyzer = new GitAnalyzer(workspaceRoot);

    // Initialize handlers
    this.handlers = {
      "git.status": createStatusHandler(gitProvider, logger),
      "git.pull": createPullHandler(gitProvider, logger),
      "git.commit": createCommitHandler(gitProvider, logger),
      "git.smartCommit": createSmartCommitHandler(
        gitProvider,
        logger,
        this.changeGrouper,
        this.messageSuggester,
        this.batchCommitter,
        approvalUI,
        generateProseFn
      ),
      "git.analyzeInbound": createAnalyzeInboundHandler(
        this.inboundAnalyzer,
        logger
      ),
      "git.showAnalytics": createShowAnalyticsHandler(
        this.analyzer,
        logger
      ),
      "git.exportJson": createExportJsonHandler(
        this.analyzer,
        logger
      ),
      "git.exportCsv": createExportCsvHandler(
        this.analyzer,
        logger
      ),
      ...(generateProseFn
        ? {
            "git.generatePR": createGeneratePRHandler(gitProvider, logger, generateProseFn),
            "git.reviewPR": createReviewPRHandler(gitProvider, logger, generateProseFn),
            "git.commentPR": createCommentPRHandler(gitProvider, logger, generateProseFn),
            "git.resolveConflicts": createResolveConflictsHandler(gitProvider, logger, this.inboundAnalyzer, generateProseFn),
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
          }
        : {}),
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
  approvalUI?: ApprovalUI,
  generateProseFn?: GenerateProseFn,
  runLog?: RunLog,
  getHygieneScan?: HygieneScanGetter
): GitDomainService {
  return new GitDomainService(gitProvider, logger, workspaceRoot, approvalUI, generateProseFn, runLog, getHygieneScan);
}
