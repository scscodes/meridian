/**
 * Command Router — Aiogram-style registry pattern
 * Routes commands to handlers with middleware support.
 */

import {
  Command,
  CommandContext,
  CommandName,
  Handler,
  HandlerRegistry,
  Middleware,
  MiddlewareContext,
  Result,
  failure,
  success,
  AppError,
  DomainService,
  DispatchEvent,
  DispatchCompleteEvent,
  Event,
} from "./types";
import { Logger } from "./types";

export class CommandRouter {
  private handlers: Partial<HandlerRegistry> = {};
  private middlewares: Middleware[] = [];
  private logger: Logger;
  private domains: Map<string, DomainService> = new Map();
  private beforeListeners: Array<(e: DispatchEvent) => void> = [];
  private afterListeners: Array<(e: DispatchCompleteEvent) => void> = [];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Register handlers from a domain service.
   * Validates command names upfront, no late binding.
   */
  registerDomain(domain: DomainService): void {
    if (this.domains.has(domain.name)) {
      this.logger.warn(
        `Domain '${domain.name}' already registered, skipping`,
        "CommandRouter.registerDomain"
      );
      return;
    }

    const domain_handlers = Object.entries(domain.handlers);
    for (const [name, handler] of domain_handlers) {
      if (this.handlers[name as CommandName]) {
        const err: AppError = {
          code: "HANDLER_CONFLICT",
          message: `Handler '${name}' already registered`,
          context: "CommandRouter.registerDomain",
        };
        this.logger.error(
          `Cannot register '${name}': handler conflict`,
          "CommandRouter.registerDomain",
          err
        );
        throw err;
      }
      this.handlers[name as CommandName] = handler as Handler;
    }

    this.domains.set(domain.name, domain);
    this.logger.info(
      `Registered ${domain_handlers.length} handlers from domain '${domain.name}'`,
      "CommandRouter.registerDomain"
    );
  }

  /**
   * Register a middleware for cross-cutting concerns.
   * Executed in order before handler dispatch.
   */
  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  readonly onBeforeHandler: Event<DispatchEvent> = (listener) => {
    this.beforeListeners.push(listener);
    return {
      dispose: () => {
        const i = this.beforeListeners.indexOf(listener);
        if (i !== -1) this.beforeListeners.splice(i, 1);
      },
    };
  };

  readonly onAfterHandler: Event<DispatchCompleteEvent> = (listener) => {
    this.afterListeners.push(listener);
    return {
      dispose: () => {
        const i = this.afterListeners.indexOf(listener);
        if (i !== -1) this.afterListeners.splice(i, 1);
      },
    };
  };

  private fireBefore(event: DispatchEvent): void {
    for (const l of this.beforeListeners) {
      try {
        l(event);
      } catch (err) {
        this.logger.warn(
          `onBeforeHandler listener threw: ${err}`,
          "CommandRouter.fireBefore"
        );
      }
    }
  }

  private fireAfter(event: DispatchCompleteEvent): void {
    for (const l of this.afterListeners) {
      try {
        l(event);
      } catch (err) {
        this.logger.warn(
          `onAfterHandler listener threw: ${err}`,
          "CommandRouter.fireAfter"
        );
      }
    }
  }

  /**
   * Dispatch a command through the middleware chain to its handler.
   * Returns Result monad — no exceptions thrown.
   */
  async dispatch(
    command: Command,
    context: CommandContext
  ): Promise<Result<unknown>> {
    const handler = this.handlers[command.name];

    if (!handler) {
      const err: AppError = {
        code: "HANDLER_NOT_FOUND",
        message: `No handler registered for command '${command.name}'`,
        context: command.name,
      };
      this.logger.warn(
        `Command not found: ${command.name}`,
        "CommandRouter.dispatch",
        err
      );
      return failure(err);
    }

    const mwCtx: MiddlewareContext = {
      commandName: command.name,
      startTime: Date.now(),
      permissions: [],
    };

    try {
      // Execute middleware chain
      await this.executeMiddlewares(mwCtx, 0);
    } catch (mwErr) {
      const err: AppError = {
        code: "MIDDLEWARE_ERROR",
        message: `Middleware execution failed for '${command.name}'`,
        details: mwErr,
        context: "CommandRouter.dispatch",
      };
      this.logger.error(
        `Middleware failed: ${command.name}`,
        "CommandRouter.dispatch",
        err
      );
      return failure(err);
    }

    this.fireBefore({ command, context: mwCtx });

    try {
      const result = await handler(context, command.params);
      const duration = Date.now() - mwCtx.startTime;
      this.logger.info(
        `Command '${command.name}' executed in ${duration}ms`,
        "CommandRouter.dispatch"
      );
      this.fireAfter({ command, context: mwCtx, result });
      return result;
    } catch (handlerErr) {
      const err: AppError = {
        code: "HANDLER_ERROR",
        message: `Handler for '${command.name}' threw an exception`,
        details: handlerErr,
        context: command.name,
      };
      this.logger.error(
        `Handler error: ${command.name}`,
        "CommandRouter.dispatch",
        err
      );
      const failResult = failure(err);
      this.fireAfter({ command, context: mwCtx, result: failResult });
      return failResult;
    }
  }

  /**
   * Execute middleware chain recursively.
   */
  private async executeMiddlewares(
    ctx: MiddlewareContext,
    index: number
  ): Promise<void> {
    if (index >= this.middlewares.length) {
      return;
    }

    const middleware = this.middlewares[index];
    await middleware(ctx, () => this.executeMiddlewares(ctx, index + 1));
  }

  /**
   * List registered command names.
   */
  listCommands(): CommandName[] {
    return Object.keys(this.handlers) as CommandName[];
  }

  /**
   * List registered domains.
   */
  listDomains(): string[] {
    return Array.from(this.domains.keys());
  }

  /**
   * Validate that all required commands for a domain are registered.
   */
  async validateDomains(): Promise<Result<void>> {
    const errors: string[] = [];

    for (const [domainName, domain] of this.domains) {
      const domainHandlers = Object.keys(domain.handlers);
      for (const handlerName of domainHandlers) {
        if (!this.handlers[handlerName as CommandName]) {
          errors.push(
            `Domain '${domainName}' handler '${handlerName}' not in registry`
          );
        }
      }

      // Call domain initialization if defined
      if (domain.initialize) {
        const initResult = await domain.initialize();
        if (initResult.kind === "err") {
          errors.push(
            `Domain '${domainName}' initialization failed: ${initResult.error.message}`
          );
        }
      }
    }

    if (errors.length > 0) {
      const err: AppError = {
        code: "VALIDATION_ERROR",
        message: `Domain validation failed`,
        details: errors,
        context: "CommandRouter.validateDomains",
      };
      this.logger.error(
        `Domain validation failed: ${errors.length} errors`,
        "CommandRouter.validateDomains",
        err
      );
      return failure(err);
    }

    this.logger.info(
      `All ${this.domains.size} domains validated successfully`,
      "CommandRouter.validateDomains"
    );
    return success(void 0);
  }

  /**
   * Cleanup: call teardown on all domains in reverse order.
   */
  async teardown(): Promise<void> {
    const domains = Array.from(this.domains.values()).reverse();
    for (const domain of domains) {
      if (domain.teardown) {
        try {
          await domain.teardown();
        } catch (err) {
          this.logger.warn(
            `Domain '${domain.name}' teardown threw: ${err}`,
            "CommandRouter.teardown"
          );
        }
      }
    }
    this.logger.info("Router teardown complete", "CommandRouter.teardown");
  }
}
