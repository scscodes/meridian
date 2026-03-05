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
import { GenerateProseFn } from "../../types";

/**
 * Chat domain commands.
 */
export const CHAT_COMMANDS: ChatCommandName[] = [
  "chat.context",
  "chat.delegate",
];

export class ChatDomainService implements DomainService {
  readonly name = "chat";

  handlers: Partial<Record<ChatCommandName, Handler<any, any>>> = {};
  private logger: Logger;

  constructor(
    gitProvider: GitProvider,
    logger: Logger,
    dispatcher: CommandDispatcher,
    generateProseFn?: GenerateProseFn
  ) {
    this.logger = logger;

    this.handlers = {
      "chat.context": createContextHandler(gitProvider, logger),
      "chat.delegate": createDelegateHandler(dispatcher, logger, generateProseFn),
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
  dispatcher: CommandDispatcher,
  generateProseFn?: GenerateProseFn
): ChatDomainService {
  return new ChatDomainService(gitProvider, logger, dispatcher, generateProseFn);
}
