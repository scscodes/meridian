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

/**
 * A message in a model conversation.
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Options for a model request.
 */
export interface ModelRequestOptions {
  /** What this request is for — determines tier selection */
  role: ModelRole;
  /** Conversation messages */
  messages: ChatMessage[];
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
  /** Generated content */
  content: string;
  /** Which model actually handled the request */
  model: ResolvedModel;
  /** Token usage (if reported by provider) */
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

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
