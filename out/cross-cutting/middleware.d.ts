/**
 * Cross-cutting middleware for logging, error handling, and authentication.
 * Declaratively applied to all commands.
 */
import { Middleware, Logger } from "../types";
import { TelemetryTracker } from "../infrastructure/telemetry";
/**
 * Observability middleware — unified logging + telemetry in a single timing pass.
 * Replaces the former createLoggingMiddleware + createTelemetryMiddleware pair.
 */
export declare function createObservabilityMiddleware(logger: Logger, telemetry: TelemetryTracker): Middleware;
/**
 * Permission middleware — checks command-level access control.
 */
export declare function createPermissionMiddleware(logger: Logger, permissionChecker: (commandName: string) => boolean): Middleware;
/**
 * Rate-limiting middleware — prevents command spam.
 */
export declare function createRateLimitMiddleware(logger: Logger, maxPerSecond?: number): Middleware;
/**
 * Audit middleware — logs significant state changes for compliance.
 */
export declare function createAuditMiddleware(logger: Logger): Middleware;
//# sourceMappingURL=middleware.d.ts.map