import type { ModelRole, ModelTier } from './settings.js';

/**
 * A resolved model — concrete model selected for a specific role and tier.
 */
export interface ResolvedModel {
  /** Provider-specific model identifier */
  id: string;
  /** Human-readable model name */
  name: string;
  /** Which tier this model occupies */
  tier: ModelTier;
  /** What role it was resolved for */
  role: ModelRole;
  /** Provider name (e.g. 'anthropic', 'openai', 'copilot') */
  provider: string;
}

// ─── Tool Calling Protocol ─────────────────────────────────────────────────

/**
 * JSON Schema describing a tool's input parameters for the model.
 * Provider implementations translate this to their native format.
 */
export interface ToolDefinition {
  /** Tool name (matches ToolRegistryEntry.chatCommand for routing) */
  name: string;
  /** Human-readable description for the model */
  description: string;
  /** JSON Schema object describing accepted parameters */
  inputSchema: Record<string, unknown>;
}

/**
 * A tool invocation requested by the model during the agentic loop.
 */
export interface ToolCall {
  /** Unique ID for this call (used to correlate with ToolResult) */
  id: string;
  /** Tool name (matches ToolDefinition.name) */
  name: string;
  /** Arguments the model provided, validated against inputSchema */
  arguments: Record<string, unknown>;
}

/**
 * Result of executing a tool call, fed back to the model.
 */
export interface ToolResult {
  /** Correlates to ToolCall.id */
  toolCallId: string;
  /** Serialized result content (typically JSON or markdown) */
  content: string;
  /** Whether the tool execution failed */
  isError?: boolean;
}

/**
 * Why the model stopped generating.
 */
export type StopReason = 'end_turn' | 'tool_use' | 'max_tokens';

// ─── Messages ──────────────────────────────────────────────────────────────

/**
 * A message in a model conversation.
 *
 * Extended to support tool calling:
 * - Assistant messages may include `toolCalls` when the model wants to invoke tools
 * - Tool result messages use role 'tool_result' with `toolCallId` linking back
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool_result';
  content: string;
  /** Present when assistant response includes tool call requests */
  toolCalls?: ToolCall[];
  /** Present for tool_result messages — links back to ToolCall.id */
  toolCallId?: string;
}

// ─── Request / Response ────────────────────────────────────────────────────

/**
 * Options for a model request.
 */
export interface ModelRequestOptions {
  /** What this request is for — determines tier selection */
  role: ModelRole;
  /** Conversation messages */
  messages: ChatMessage[];
  /** Tool definitions the model is allowed to invoke (optional) */
  tools?: ToolDefinition[];
  /** Max tokens to generate (optional, provider defaults apply) */
  maxTokens?: number;
  /** Temperature (optional, provider defaults apply) */
  temperature?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Response from a model request.
 */
export interface ModelResponse {
  /** Generated text content (may be empty if stopReason is 'tool_use') */
  content: string;
  /** Which model actually handled the request */
  model: ResolvedModel;
  /** Token usage (if reported by provider) */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Tool calls the model wants to execute (present when stopReason is 'tool_use') */
  toolCalls?: ToolCall[];
  /** Why generation stopped */
  stopReason?: StopReason;
}

// ─── Provider Interface ────────────────────────────────────────────────────

/**
 * Interface that all model providers must implement.
 *
 * Implementations:
 * - VscodeLmProvider (packages/vscode) — uses vscode.lm API
 * - DirectApiProvider (packages/vscode) — uses direct API keys
 */
export interface IModelProvider {
  /** Unique provider identifier */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;

  /** Check if this provider is available and configured */
  isAvailable(): Promise<boolean>;

  /** List models available from this provider */
  listModels(): Promise<ResolvedModel[]>;

  /** Send a request to the model */
  sendRequest(options: ModelRequestOptions): Promise<ModelResponse>;

  /** Release any held resources */
  dispose(): void;
}
