/**
 * Agent Execution Handler — execute an agent with a workflow or single command.
 *
 * Agents declare capabilities (commands they can run) and workflow triggers.
 * This handler validates the agent exists + has the requested capability,
 * then routes execution to either:
 *  1. WorkflowEngine (if agent has workflowTriggers + a workflow is requested)
 *  2. CommandRouter (if a single command is requested)
 *
 * Result is a structured execution report: success, log entries, timing, output.
 */

import {
  Handler,
  CommandContext,
  Logger,
  Result,
  success,
  failure,
  Command,
  AgentDefinition,
} from "../../types";
import { AGENT_ERROR_CODES, GENERIC_ERROR_CODES } from "../../infrastructure/error-codes";
import { ExecuteAgentParams, AgentExecutionResult, ExecutionLog } from "./types";
import { loadAgents } from "../../infrastructure/agent-registry";

interface ExecutionState {
  agentId: string;
  targetCommand?: string;
  targetWorkflow?: string;
  startTime: number;
  logs: ExecutionLog[];
  output?: Record<string, unknown>;
  success: boolean;
  error?: string;
}

class AgentExecutor {
  constructor(
    private logger: Logger,
    private commandDispatcher: (cmd: Command, ctx: CommandContext) => Promise<Result<unknown>>,
    private workspaceRoot?: string,
    private extensionPath?: string
  ) {}

  async execute(
    agentId: string,
    targetCommand?: string,
    targetWorkflow?: string,
    params?: Record<string, unknown>,
    ctx?: CommandContext
  ): Promise<Result<AgentExecutionResult>> {
    const state: ExecutionState = {
      agentId,
      targetCommand,
      targetWorkflow,
      startTime: Date.now(),
      logs: [],
      success: false,
    };

    try {
      // Load agent from registry
      const agents = loadAgents(this.workspaceRoot, this.extensionPath);
      const agent = agents.get(agentId);

      if (!agent) {
        return failure({
          code: AGENT_ERROR_CODES.AGENT_NOT_FOUND,
          message: `Agent '${agentId}' not found in registry`,
          context: "AgentExecutor.execute",
        });
      }

      this.log(state, `Agent '${agentId}' loaded`);

      // Validate agent has requested capability (if command-based execution)
      if (targetCommand && !agent.capabilities.includes(targetCommand as any)) {
        return failure({
          code: AGENT_ERROR_CODES.MISSING_CAPABILITY,
          message: `Agent '${agentId}' does not have capability '${targetCommand}'`,
          context: "AgentExecutor.execute",
        });
      }

      // Validate agent has workflow trigger (if workflow-based execution)
      if (targetWorkflow && !(agent.workflowTriggers || []).includes(targetWorkflow)) {
        this.logger.warn(
          `Agent '${agentId}' does not declare workflow trigger '${targetWorkflow}'`,
          "AgentExecutor"
        );
        // Note: This is a warning, not a failure — agents may trigger workflows indirectly
      }

      // Route execution
      if (targetCommand) {
        // Execute single command
        const cmdResult = await this.executeCommand(
          targetCommand,
          params || {},
          ctx || {
            extensionPath: this.extensionPath || "",
            workspaceFolders: this.workspaceRoot ? [this.workspaceRoot] : [],
          },
          state
        );

        if (cmdResult.kind === "err") {
          state.success = false;
          state.error = cmdResult.error.message;
          this.log(state, `Command '${targetCommand}' failed: ${cmdResult.error.message}`);
          return success(this.buildResult(state, agent));
        }

        state.success = true;
        state.output = cmdResult.value as Record<string, unknown>;
        this.log(state, `Command '${targetCommand}' completed successfully`);
        return success(this.buildResult(state, agent));
      } else if (targetWorkflow) {
        // Execute workflow (delegated to WorkflowEngine via commandDispatcher)
        const workflowCmd: Command = {
          name: "workflow.run",
          params: { workflowName: targetWorkflow, ...params },
        };

        const ctx_ = ctx || {
          extensionPath: this.extensionPath || "",
          workspaceFolders: this.workspaceRoot ? [this.workspaceRoot] : [],
        };

        const wfResult = await this.commandDispatcher(workflowCmd, ctx_);

        if (wfResult.kind === "err") {
          state.success = false;
          state.error = wfResult.error.message;
          this.log(state, `Workflow '${targetWorkflow}' failed: ${wfResult.error.message}`);
          return success(this.buildResult(state, agent));
        }

        state.success = true;
        state.output = wfResult.value as Record<string, unknown>;
        this.log(state, `Workflow '${targetWorkflow}' completed successfully`);
        return success(this.buildResult(state, agent));
      } else {
        return failure({
          code: GENERIC_ERROR_CODES.INVALID_PARAMS,
          message: "Agent execution requires either targetCommand or targetWorkflow",
          context: "AgentExecutor.execute",
        });
      }
    } catch (err) {
      state.success = false;
      state.error = err instanceof Error ? err.message : String(err);
      this.log(state, `Execution error: ${state.error}`);

      return failure({
        code: AGENT_ERROR_CODES.EXECUTION_FAILED,
        message: `Agent '${agentId}' execution failed: ${state.error}`,
        details: err,
        context: "AgentExecutor.execute",
      });
    }
  }

  private async executeCommand(
    commandName: string,
    params: Record<string, unknown>,
    ctx: CommandContext,
    state: ExecutionState
  ): Promise<Result<unknown>> {
    this.log(state, `Dispatching command '${commandName}' with params: ${JSON.stringify(params)}`);

    const cmd: Command = {
      name: commandName as any,
      params,
    };

    return this.commandDispatcher(cmd, ctx);
  }

  private log(state: ExecutionState, message: string): void {
    const entry: ExecutionLog = {
      timestamp: new Date().toISOString(),
      level: "info",
      message,
    };
    state.logs.push(entry);
    this.logger.info(message, "AgentExecutor");
  }

  private buildResult(state: ExecutionState, agent: AgentDefinition): AgentExecutionResult {
    return {
      agentId: state.agentId,
      success: state.success,
      durationMs: Date.now() - state.startTime,
      logs: state.logs,
      output: state.output,
      error: state.error,
      executedCommand: state.targetCommand,
      executedWorkflow: state.targetWorkflow,
      agentCapabilities: agent.capabilities,
    };
  }
}

export function createExecuteAgentHandler(
  logger: Logger,
  commandDispatcher: (cmd: Command, ctx: CommandContext) => Promise<Result<unknown>>,
  workspaceRoot?: string,
  extensionPath?: string
): Handler<ExecuteAgentParams, AgentExecutionResult> {
  const executor = new AgentExecutor(logger, commandDispatcher, workspaceRoot, extensionPath);

  return async (ctx: CommandContext, params: ExecuteAgentParams): Promise<Result<AgentExecutionResult>> => {
    try {
      // Validate required params
      if (!params.agentId) {
        return failure({
          code: GENERIC_ERROR_CODES.INVALID_PARAMS,
          message: "Agent execution requires agentId",
          context: "agent.execute",
        });
      }

      if (!params.targetCommand && !params.targetWorkflow) {
        return failure({
          code: GENERIC_ERROR_CODES.INVALID_PARAMS,
          message: "Agent execution requires either targetCommand or targetWorkflow",
          context: "agent.execute",
        });
      }

      logger.info(
        `Executing agent '${params.agentId}' ${
          params.targetCommand ? `command '${params.targetCommand}'` : `workflow '${params.targetWorkflow}'`
        }`,
        "ExecuteAgentHandler"
      );

      return executor.execute(
        params.agentId,
        params.targetCommand,
        params.targetWorkflow,
        params.params,
        ctx
      );
    } catch (err) {
      return failure({
        code: AGENT_ERROR_CODES.EXECUTION_FAILED,
        message: `Failed to execute agent: ${err instanceof Error ? err.message : String(err)}`,
        details: err,
        context: "agent.execute",
      });
    }
  };
}
