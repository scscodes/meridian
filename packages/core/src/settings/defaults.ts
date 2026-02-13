import type { ExtensionSettings, CommitConstraints, ModelTierMap, AgentSettings } from '../types/index.js';

// ─── Commit Constraints ─────────────────────────────────────────────────────

/** Minimum commit message length (characters) */
const COMMIT_MIN_LENGTH = 10;

/** Maximum first-line length (characters) — conventional git standard */
const COMMIT_MAX_LENGTH = 72;

export const DEFAULT_COMMIT_CONSTRAINTS: CommitConstraints = {
  minLength: COMMIT_MIN_LENGTH,
  maxLength: COMMIT_MAX_LENGTH,
  prefix: '',
  suffix: '',
  enforcement: 'warn',
};

// ─── Model Tiers ────────────────────────────────────────────────────────────

/**
 * Default model tier assignments.
 * Empty strings mean "not yet configured" — the provider will use
 * whatever is available, or prompt the user to assign models.
 */
export const DEFAULT_MODEL_TIERS: ModelTierMap = {
  high: '',
  mid: '',
  low: '',
};

// ─── Agent Settings ──────────────────────────────────────────────────────────

/** Maximum tool-call round-trips per conversation turn */
const AGENT_DEFAULT_MAX_TURNS = 10;

/** Maximum total tokens (input + output) per agent run */
const AGENT_DEFAULT_MAX_TOKEN_BUDGET = 32000;

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  maxTurns: AGENT_DEFAULT_MAX_TURNS,
  maxTokenBudget: AGENT_DEFAULT_MAX_TOKEN_BUDGET,
  systemPrompt: '',
};

// ─── Root Settings ──────────────────────────────────────────────────────────

/**
 * Complete default settings.
 * Every configurable value lives here — no magic numbers elsewhere.
 */
export const DEFAULT_SETTINGS: ExtensionSettings = {
  mode: 'balanced',
  modelTiers: DEFAULT_MODEL_TIERS,
  providerSource: 'ide',
  enabledLanguages: ['typescript', 'javascript', 'python'],
  commitConstraints: DEFAULT_COMMIT_CONSTRAINTS,
  preCommitDryRun: true,
  agent: DEFAULT_AGENT_SETTINGS,
};
