"use strict";
/**
 * Git Domain Service — DDD-style domain service.
 * Isolated, testable business logic with robust error handling.
 *
 * ✓ All GitProvider calls wrapped in Result<T> checks
 * ✓ Null/undefined guards before property access
 * ✓ Try-catch for async operations with proper error context
 * ✓ Graceful degradation (cache miss fallback)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitDomainService = exports.GIT_COMMANDS = void 0;
exports.createGitDomain = createGitDomain;
const types_1 = require("../../types");
const handlers_1 = require("./handlers");
const smart_commit_handler_1 = require("./smart-commit-handler");
const inbound_handler_1 = require("./inbound-handler");
const pr_handlers_1 = require("./pr-handlers");
const session_handler_1 = require("./session-handler");
const analytics_handler_1 = require("./analytics-handler");
const smart_commit_service_1 = require("./smart-commit-service");
const inbound_analyzer_1 = require("./inbound-analyzer");
const analytics_service_1 = require("./analytics-service");
// ============================================================================
// Git domain commands.
// ============================================================================
exports.GIT_COMMANDS = [
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
class GitDomainService {
    constructor(gitProvider, logger, workspaceRoot = process.cwd(), approvalUI, generateProseFn) {
        this.name = "git";
        this.handlers = {};
        this.gitProvider = gitProvider;
        this.logger = logger;
        // Initialize smart commit components
        this.changeGrouper = new smart_commit_service_1.ChangeGrouper();
        this.messageSuggester = new smart_commit_service_1.CommitMessageSuggester();
        this.batchCommitter = new smart_commit_service_1.BatchCommitter(gitProvider, logger);
        // Initialize inbound analyzer
        this.inboundAnalyzer = new inbound_analyzer_1.InboundAnalyzer(gitProvider, logger);
        // Initialize analytics — pass workspace root so git log runs in the correct repo
        this.analyzer = new analytics_service_1.GitAnalyzer(workspaceRoot);
        // Initialize handlers
        this.handlers = {
            "git.status": (0, handlers_1.createStatusHandler)(gitProvider, logger),
            "git.pull": (0, handlers_1.createPullHandler)(gitProvider, logger),
            "git.commit": (0, handlers_1.createCommitHandler)(gitProvider, logger),
            "git.smartCommit": (0, smart_commit_handler_1.createSmartCommitHandler)(gitProvider, logger, this.changeGrouper, this.messageSuggester, this.batchCommitter, approvalUI),
            "git.analyzeInbound": (0, inbound_handler_1.createAnalyzeInboundHandler)(this.inboundAnalyzer, logger),
            "git.showAnalytics": (0, analytics_handler_1.createShowAnalyticsHandler)(this.analyzer, logger),
            "git.exportJson": (0, analytics_handler_1.createExportJsonHandler)(this.analyzer, logger),
            "git.exportCsv": (0, analytics_handler_1.createExportCsvHandler)(this.analyzer, logger),
            ...(generateProseFn
                ? {
                    "git.generatePR": (0, pr_handlers_1.createGeneratePRHandler)(gitProvider, logger, generateProseFn),
                    "git.reviewPR": (0, pr_handlers_1.createReviewPRHandler)(gitProvider, logger, generateProseFn),
                    "git.commentPR": (0, pr_handlers_1.createCommentPRHandler)(gitProvider, logger, generateProseFn),
                    "git.resolveConflicts": (0, pr_handlers_1.createResolveConflictsHandler)(gitProvider, logger, this.inboundAnalyzer, generateProseFn),
                    "git.sessionBriefing": (0, session_handler_1.createSessionBriefingHandler)(gitProvider, logger, generateProseFn),
                }
                : {}),
        };
    }
    /**
     * Initialize domain — verify git is available, check repo state.
     */
    async initialize() {
        try {
            this.logger.info("Initializing git domain", "GitDomainService.initialize");
            // Check git availability by executing git status
            const statusResult = await this.gitProvider.status();
            if (statusResult.kind === "err") {
                return (0, types_1.failure)({
                    code: "GIT_UNAVAILABLE",
                    message: "Git is not available or not initialized",
                    details: statusResult.error,
                    context: "GitDomainService.initialize",
                });
            }
            this.logger.info(`Git initialized (branch: ${statusResult.value.branch})`, "GitDomainService.initialize");
            return (0, types_1.success)(void 0);
        }
        catch (err) {
            return (0, types_1.failure)({
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
    async teardown() {
        this.logger.debug("Tearing down git domain", "GitDomainService.teardown");
    }
}
exports.GitDomainService = GitDomainService;
/**
 * Factory function — creates and returns git domain service.
 */
function createGitDomain(gitProvider, logger, workspaceRoot = process.cwd(), approvalUI, generateProseFn) {
    return new GitDomainService(gitProvider, logger, workspaceRoot, approvalUI, generateProseFn);
}
//# sourceMappingURL=service.js.map