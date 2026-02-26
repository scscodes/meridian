/**
 * Chat/Copilot Domain Service — local context gathering and task delegation.
 */

import {
  DomainService,
  ChatCommandName,
  Handler,
  Logger,
  GitProvider,
  Result,
  success,
  failure,
} from "../../types";
import {
  createContextHandler,
  createDelegateHandler,
  CommandDispatcher,
} from "./handlers";

/**
 * Chat domain commands.
 */
export const CHAT_COMMANDS: ChatCommandName[] = [
  "chat.context",
  "chat.delegate",
];

export class ChatDomainService implements DomainService {
  readonly name = "chat";

  handlers: Partial<Record<ChatCommandName, Handler>> = {};
  private logger: Logger;

  constructor(
    gitProvider: GitProvider,
    logger: Logger,
    dispatcher: CommandDispatcher
  ) {
    this.logger = logger;

    this.handlers = {
      "chat.context": createContextHandler(gitProvider, logger) as Handler,
      "chat.delegate": createDelegateHandler(dispatcher, logger) as Handler,
    };
  }

  async initialize(): Promise<Result<void>> {
    try {
      this.logger.info(
        "Initializing chat domain",
        "ChatDomainService.initialize"
      );
      return success(void 0);
    } catch (err) {
      return failure({
        code: "CHAT_INIT_ERROR",
        message: "Failed to initialize chat domain",
        details: err,
        context: "ChatDomainService.initialize",
      });
    }
  }

  async teardown(): Promise<void> {
    this.logger.debug(
      "Tearing down chat domain",
      "ChatDomainService.teardown"
    );
  }
}

/**
 * Factory function — creates and returns chat domain service.
 */
export function createChatDomain(
  gitProvider: GitProvider,
  logger: Logger,
  dispatcher: CommandDispatcher
): ChatDomainService {
  return new ChatDomainService(gitProvider, logger, dispatcher);
}
