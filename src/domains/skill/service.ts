/**
 * Skill Domain Service — built-in composite commands.
 */

import {
  DomainService,
  SkillCommandName,
  Handler,
  Logger,
  Result,
  success,
} from "../../types";
import { createOverviewHandler, createPrReadyHandler, createPreMergeHandler, CommandDispatcher } from "./handlers";

export const SKILL_COMMANDS: SkillCommandName[] = [
  "skill.overview",
  "skill.prReady",
  "skill.preMerge",
];

export class SkillDomainService implements DomainService {
  readonly name = "skill";
  handlers: Partial<Record<SkillCommandName, Handler<any, any>>> = {};
  private logger: Logger;

  constructor(logger: Logger, dispatcher: CommandDispatcher) {
    this.logger = logger;
    this.handlers = {
      "skill.overview": createOverviewHandler(dispatcher, logger),
      "skill.prReady": createPrReadyHandler(dispatcher, logger),
      "skill.preMerge": createPreMergeHandler(dispatcher, logger),
    };
  }

  async initialize(): Promise<Result<void>> {
    this.logger.info("Skill domain initialized", "SkillDomainService");
    return success(void 0);
  }

  async teardown(): Promise<void> {
    this.logger.debug("Skill domain torn down", "SkillDomainService");
  }
}

export function createSkillDomain(
  logger: Logger,
  dispatcher: CommandDispatcher
): SkillDomainService {
  return new SkillDomainService(logger, dispatcher);
}
