/**
 * Chat/Copilot Domain Handlers — local context gathering and task delegation.
 */
import { Handler, CommandContext, Command, Result, ChatContext, Logger, GitProvider } from "../../types";
/**
 * chat.context — Gather chat context from workspace + git.
 * Returns active file path, current git branch, and git status.
 */
export declare function createContextHandler(gitProvider: GitProvider, logger: Logger): Handler<Record<string, never>, ChatContext>;
export interface DelegateParams {
    task: string;
}
export interface DelegateResult {
    dispatched: boolean;
    commandName: string;
    result: unknown;
}
/** Minimal dispatcher interface; satisfied by CommandRouter.dispatch */
export type CommandDispatcher = (command: Command, ctx: CommandContext) => Promise<Result<unknown>>;
/**
 * Minimal prose generation interface — compatible with generateProse from infrastructure
 * without introducing a cross-domain import.
 */
export type GenerateProseFn = (req: {
    domain: "hygiene" | "git" | "chat";
    systemPrompt: string;
    data: Record<string, unknown>;
}) => Promise<Result<string>>;
/**
 * chat.delegate — Programmatic task router.
 * Uses the LLM to classify a free-form task description into a command, then
 * dispatches it. Intended for workflows, LM tools, and future agents — not the
 * chat UX (which routes directly via SLASH_MAP/KEYWORD_MAP/classifier).
 */
export declare function createDelegateHandler(dispatcher: CommandDispatcher, logger: Logger, generateProseFn?: GenerateProseFn): Handler<DelegateParams, DelegateResult>;
//# sourceMappingURL=handlers.d.ts.map