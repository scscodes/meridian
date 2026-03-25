/**
 * Git Domain Service — DDD-style domain service.
 * Isolated, testable business logic with robust error handling.
 *
 * ✓ All GitProvider calls wrapped in Result<T> checks
 * ✓ Null/undefined guards before property access
 * ✓ Try-catch for async operations with proper error context
 * ✓ Graceful degradation (cache miss fallback)
 */
import { DomainService, GitCommandName, Handler, Logger, GitProvider, Result } from "../../types";
import { GenerateProseFn } from "../../types";
import { ApprovalUI } from "./types";
import { ChangeGrouper, CommitMessageSuggester, BatchCommitter } from "./smart-commit-service";
import { InboundAnalyzer } from "./inbound-analyzer";
import { GitAnalyzer } from "./analytics-service";
export declare const GIT_COMMANDS: GitCommandName[];
export declare class GitDomainService implements DomainService {
    readonly name = "git";
    handlers: Partial<Record<GitCommandName, Handler<any, any>>>;
    private gitProvider;
    private logger;
    changeGrouper: ChangeGrouper;
    messageSuggester: CommitMessageSuggester;
    batchCommitter: BatchCommitter;
    inboundAnalyzer: InboundAnalyzer;
    analyzer: GitAnalyzer;
    constructor(gitProvider: GitProvider, logger: Logger, workspaceRoot?: string, approvalUI?: ApprovalUI, generateProseFn?: GenerateProseFn);
    /**
     * Initialize domain — verify git is available, check repo state.
     */
    initialize(): Promise<Result<void>>;
    /**
     * Cleanup — no resources to release, but log completion.
     */
    teardown(): Promise<void>;
}
/**
 * Factory function — creates and returns git domain service.
 */
export declare function createGitDomain(gitProvider: GitProvider, logger: Logger, workspaceRoot?: string, approvalUI?: ApprovalUI, generateProseFn?: GenerateProseFn): GitDomainService;
//# sourceMappingURL=service.d.ts.map