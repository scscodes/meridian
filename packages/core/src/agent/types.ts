import type { ToolCall, ToolResult, ToolDefinition, ToolId } from '../types/index.js';

/** Configuration for an agent run */
export interface AgentConfig {
  /** Maximum tool-call round-trips before forced stop */
  maxTurns: number;
  /** Maximum total tokens (input + output) before forced stop */
  maxTokenBudget: number;
  /** System prompt text (empty = built-in default) */
  systemPrompt: string;
  /** Tool definitions available to the model */
  availableTools: ToolDefinition[];
}

/**
 * Actions yielded by the agent loop for the host to execute.
 * Discriminated union — the host pattern-matches on `type`.
 */
export type AgentAction =
  | AgentToolCallAction
  | AgentConfirmationAction
  | AgentResponseAction
  | AgentErrorAction;

export interface AgentToolCallAction {
  type: 'tool_call';
  toolId: ToolId;
  callId: string;
  args: Record<string, unknown>;
}

export interface AgentConfirmationAction {
  type: 'confirmation_required';
  toolId: ToolId;
  callId: string;
  args: Record<string, unknown>;
  description: string;
}

export interface AgentResponseAction {
  type: 'response';
  content: string;
  usage?: { totalInputTokens: number; totalOutputTokens: number };
}

export interface AgentErrorAction {
  type: 'error';
  message: string;
}

/** A complete conversation turn for history tracking */
export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: number;
}
