/**
 * Agent domain types and interfaces.
 */
/**
 * Result of listing agents.
 */
export interface ListAgentsResult {
    agents: AgentInfo[];
    count: number;
}
/**
 * Agent information summary.
 */
export interface AgentInfo {
    id: string;
    description?: string;
    version?: string;
    capabilities: string[];
    workflowTriggers?: string[];
}
/**
 * Parameters for agent execution.
 */
export interface ExecuteAgentParams {
    agentId: string;
    targetCommand?: string;
    targetWorkflow?: string;
    params?: Record<string, unknown>;
}
/**
 * Log entry from agent execution.
 */
export interface ExecutionLog {
    timestamp: string;
    level: "debug" | "info" | "warn" | "error";
    message: string;
}
/**
 * Result of agent execution.
 */
export interface AgentExecutionResult {
    agentId: string;
    success: boolean;
    durationMs: number;
    logs: ExecutionLog[];
    output?: Record<string, unknown>;
    error?: string;
    executedCommand?: string;
    executedWorkflow?: string;
    agentCapabilities: string[];
}
//# sourceMappingURL=types.d.ts.map