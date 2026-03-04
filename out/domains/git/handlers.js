"use strict";
/**
 * Git Domain Handlers — Core commit and pull operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStatusHandler = createStatusHandler;
exports.createPullHandler = createPullHandler;
exports.createCommitHandler = createCommitHandler;
const types_1 = require("../../types");
/**
 * Example: git.status — Read-only operation.
 * Returns current branch and dirty state.
 */
function createStatusHandler(gitProvider, logger) {
    return async (_ctx, params = {}) => {
        // Validate branch parameter shape when provided
        if (params.branch !== undefined && typeof params.branch !== "string") {
            return (0, types_1.failure)({
                code: "INVALID_PARAMS",
                message: "Branch must be a string when provided",
                context: "git.status",
            });
        }
        try {
            logger.debug(`Getting git status for branch: ${params.branch || "current"}`, "GitStatusHandler");
            const result = await gitProvider.status(params.branch);
            if (result.kind === "ok") {
                return (0, types_1.success)(result.value);
            }
            return result;
        }
        catch (err) {
            return (0, types_1.failure)({
                code: "GIT_STATUS_ERROR",
                message: "Failed to fetch git status",
                details: err,
                context: "git.status",
            });
        }
    };
}
/**
 * Example: git.pull — Mutation operation.
 * Demonstrates error handling for conflicts, network issues.
 */
function createPullHandler(gitProvider, logger) {
    return async (_ctx, params = {}) => {
        // Validate branch parameter shape when provided
        if (params.branch !== undefined && typeof params.branch !== "string") {
            return (0, types_1.failure)({
                code: "INVALID_PARAMS",
                message: "Branch must be a string when provided",
                context: "git.pull",
            });
        }
        try {
            logger.info(`Pulling from git branch: ${params.branch || "current"}`, "GitPullHandler");
            const result = await gitProvider.pull(params.branch);
            if (result.kind === "ok") {
                logger.info(`Pull successful: ${result.value.message}`, "GitPullHandler");
                return (0, types_1.success)(void 0);
            }
            return result;
        }
        catch (err) {
            return (0, types_1.failure)({
                code: "GIT_PULL_ERROR",
                message: "Failed to pull from git",
                details: err,
                context: "git.pull",
            });
        }
    };
}
/**
 * Example: git.commit — Mutation with message parameter.
 * Demonstrates parameter validation.
 */
function createCommitHandler(gitProvider, logger) {
    return async (_ctx, params = { message: "" }) => {
        // Validate branch parameter shape when provided
        if (params.branch !== undefined && typeof params.branch !== "string") {
            return (0, types_1.failure)({
                code: "INVALID_PARAMS",
                message: "Branch must be a string when provided",
                context: "git.commit",
            });
        }
        // Validate required params
        if (!params.message || params.message.trim().length === 0) {
            return (0, types_1.failure)({
                code: "INVALID_PARAMS",
                message: "Commit message is required and cannot be empty",
                context: "git.commit",
            });
        }
        try {
            logger.info(`Committing with message: "${params.message}"`, "GitCommitHandler");
            const result = await gitProvider.commit(params.message, params.branch);
            if (result.kind === "ok") {
                logger.info("Commit successful", "GitCommitHandler");
                return (0, types_1.success)(void 0);
            }
            return result;
        }
        catch (err) {
            return (0, types_1.failure)({
                code: "GIT_COMMIT_ERROR",
                message: "Failed to commit to git",
                details: err,
                context: "git.commit",
            });
        }
    };
}
//# sourceMappingURL=handlers.js.map