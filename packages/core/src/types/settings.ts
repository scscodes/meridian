import type { SupportedLanguage } from './common.js';

/**
 * Operating mode — controls model tier selection for different task types.
 *
 * See MODE_TIER_MAP in settings/schema.ts for the exact tier mapping per mode.
 */
export type OperatingMode = 'performance' | 'balanced' | 'economy';

/**
 * Model capability tier. Users assign specific models to each tier.
 */
export type ModelTier = 'high' | 'mid' | 'low';

/**
 * What the model is being used for — determines which tier is selected.
 */
export type ModelRole = 'chat' | 'tool';

/**
 * Where models come from.
 * - 'ide': Uses vscode.lm API (Copilot / Cursor built-in models)
 * - 'direct': Uses user-provided API keys (Anthropic / OpenAI)
 */
export type ModelProviderSource = 'ide' | 'direct';

/**
 * User-defined mapping of model identifiers to tiers.
 * Each tier holds a model identifier string that gets matched against available models.
 */
export interface ModelTierMap {
  high: string;
  mid: string;
  low: string;
}

/**
 * Commit message constraints. All values are explicit — no magic numbers.
 */
export interface CommitConstraints {
  /** Minimum message length (characters) */
  minLength: number;
  /** Maximum first-line length (characters) */
  maxLength: number;
  /** Required prefix, e.g. 'TEAM-123: ' (empty string = none) */
  prefix: string;
  /** Required suffix (empty string = none) */
  suffix: string;
  /** Whether violations warn or block */
  enforcement: 'warn' | 'deny';
}

/**
 * Configuration for direct API access (when providerSource is 'direct').
 */
export interface DirectApiConfig {
  provider: 'anthropic' | 'openai';
  /** API key — users should prefer environment variables for security */
  apiKey: string;
  /** Custom base URL (optional, for proxies or self-hosted endpoints) */
  baseUrl?: string;
}

/**
 * Configuration for the agentic multi-turn chat loop.
 */
export interface AgentSettings {
  /** Maximum tool-call round-trips per conversation turn */
  maxTurns: number;
  /** Maximum total tokens (input + output) per agent run */
  maxTokenBudget: number;
  /** Custom system prompt (empty string = use built-in default) */
  systemPrompt: string;
}

/**
 * Root extension settings — single source of truth for all configuration.
 *
 * Mapped 1:1 to VSCode's contributes.configuration under the 'aidev' namespace.
 * See settings/defaults.ts for default values.
 * See settings/schema.ts for validation logic.
 */
export interface ExtensionSettings {
  /** Current operating mode */
  mode: OperatingMode;
  /** Model tier assignments */
  modelTiers: ModelTierMap;
  /** Where models come from */
  providerSource: ModelProviderSource;
  /** Direct API configuration (required when providerSource is 'direct') */
  directApi?: DirectApiConfig;
  /** Languages to include in analysis */
  enabledLanguages: SupportedLanguage[];
  /** Commit message constraints */
  commitConstraints: CommitConstraints;
  /** Run pre-commit hooks in dry-run mode before committing */
  preCommitDryRun: boolean;
  /** Agentic chat loop configuration */
  agent: AgentSettings;
}
