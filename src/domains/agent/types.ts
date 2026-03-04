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
  agentId: string; // ID of the agent to execute
  targetCommand?: string; // Command to execute (e.g., "git.status")
  targetWorkflow?: string; // Workflow to run (e.g., "lint-and-commit")
  params?: Record<string, unknown>; // Parameters to pass to command/workflow
}

/**
 * Log entry from agent execution.
 */
export interface ExecutionLog {
  timestamp: string; // ISO timestamp
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
  output?: Record<string, unknown>; // Output from executed command/workflow
  error?: string; // Error message if execution failed
  executedCommand?: string; // Which command was executed
  executedWorkflow?: string; // Which workflow was executed
  agentCapabilities: string[]; // Capabilities of the executed agent
}
