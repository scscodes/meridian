/**
 * Git Domain Handlers — Core commit and pull operations.
 */
import { Handler, GitStatus, Logger, GitProvider } from "../../types";
/**
 * Example: git.status — Read-only operation.
 * Returns current branch and dirty state.
 */
export declare function createStatusHandler(gitProvider: GitProvider, logger: Logger): Handler<any, GitStatus>;
/**
 * Example: git.pull — Mutation operation.
 * Demonstrates error handling for conflicts, network issues.
 */
export declare function createPullHandler(gitProvider: GitProvider, logger: Logger): Handler<any, void>;
/**
 * Example: git.commit — Mutation with message parameter.
 * Demonstrates parameter validation.
 */
export declare function createCommitHandler(gitProvider: GitProvider, logger: Logger): Handler<any, void>;
//# sourceMappingURL=handlers.d.ts.map