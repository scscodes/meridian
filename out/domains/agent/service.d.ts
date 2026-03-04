/**
 * Agent Domain Service — discover and manage agent definitions.
 */
import { DomainService, AgentCommandName, Handler, Logger, Result, Command, CommandContext } from "../../types";
/**
 * Command dispatcher function signature — used by agent executor.
 */
export type CommandDispatcher = (cmd: Command, ctx: CommandContext) => Promise<Result<unknown>>;
/**
 * Agent domain commands.
 */
export declare const AGENT_COMMANDS: AgentCommandName[];
export declare class AgentDomainService implements DomainService {
    readonly name = "agent";
    handlers: Partial<Record<AgentCommandName, Handler>>;
    private logger;
    private workspaceRoot?;
    private extensionPath?;
    private agentCache;
    constructor(logger: Logger, workspaceRoot?: string, extensionPath?: string, commandDispatcher?: CommandDispatcher);
    /**
     * Initialize domain — discover agents.
     */
    initialize(): Promise<Result<void>>;
    /**
     * Teardown — clear caches.
     */
    teardown(): Promise<void>;
    /**
     * Discover agents from bundled and workspace locations.
     */
    private discoverAgents;
}
/**
 * Factory function — creates and returns agent domain service.
 */
export declare function createAgentDomain(logger: Logger, workspaceRoot?: string, extensionPath?: string, commandDispatcher?: CommandDispatcher): AgentDomainService;
//# sourceMappingURL=service.d.ts.map