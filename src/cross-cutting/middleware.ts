/**
 * Cross-cutting middleware for logging, error handling, and authentication.
 * Declaratively applied to all commands.
 */

import { Middleware, MiddlewareContext, Logger, AppError } from "../types";
import { TelemetryTracker } from "../infrastructure/telemetry";

/**
 * Observability middleware — unified logging + telemetry in a single timing pass.
 * Replaces the former createLoggingMiddleware + createTelemetryMiddleware pair.
 */
export function createObservabilityMiddleware(
  logger: Logger,
  telemetry: TelemetryTracker
): Middleware {
  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    logger.debug(
      `[${ctx.commandName}] Starting execution`,
      "ObservabilityMiddleware",
      { commandName: ctx.commandName }
    );

    const start = Date.now();
    telemetry.trackCommandStarted(ctx.commandName);
    try {
      await next();
      const duration = Date.now() - start;
      logger.info(
        `[${ctx.commandName}] Completed in ${duration}ms`,
        "ObservabilityMiddleware",
        { commandName: ctx.commandName, duration }
      );
      telemetry.trackCommandCompleted(ctx.commandName, duration, "success");
    } catch (err) {
      const duration = Date.now() - start;
      const appErr: AppError = {
        code: "MIDDLEWARE_ERROR",
        message: err instanceof Error ? err.message : String(err),
        details: err,
        context: ctx.commandName,
      };
      logger.error(
        `[${ctx.commandName}] Failed after ${duration}ms`,
        "ObservabilityMiddleware",
        appErr
      );
      telemetry.trackCommandFailed(ctx.commandName, duration, appErr);
      throw err;
    }
  };
}

/**
 * Audit middleware — logs significant state changes for compliance.
 */
export function createAuditMiddleware(logger: Logger): Middleware {
  return async (ctx: MiddlewareContext, next: () => Promise<void>) => {
    // Commands that should be audited (git mutations, cleanup, etc.)
    const auditCommands = [
      "git.commit",
      "git.pull",
      "hygiene.cleanup",
    ];

    if (auditCommands.includes(ctx.commandName)) {
      logger.info(
        `[AUDIT] Command invoked: ${ctx.commandName}`,
        "AuditMiddleware",
        { commandName: ctx.commandName, timestamp: new Date().toISOString() }
      );
    }

    await next();
  };
}
