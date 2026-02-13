import type { ExtensionSettings, CommitConstraints, ModelTierMap } from '../types/index.js';

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
};
