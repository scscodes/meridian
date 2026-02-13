import type {
  ExtensionSettings,
  OperatingMode,
  ModelProviderSource,
  ModelRole,
  ModelTier,
  SupportedLanguage,
} from '../types/index.js';
import { DEFAULT_SETTINGS } from './defaults.js';

// ─── Valid Value Sets ───────────────────────────────────────────────────────
// Single source of truth for all enum-like values. Used by validation,
// UI dropdowns, and the VSCode contributes.configuration.

export const VALID_MODES: readonly OperatingMode[] = [
  'performance',
  'balanced',
  'economy',
] as const;

export const VALID_PROVIDER_SOURCES: readonly ModelProviderSource[] = [
  'ide',
  'direct',
] as const;

export const VALID_LANGUAGES: readonly SupportedLanguage[] = [
  'typescript',
  'javascript',
  'python',
] as const;

// ─── Mode → Tier Mapping ───────────────────────────────────────────────────
// Defines which model tier is used for each role (chat vs tool) per mode.
// This is the core logic behind the performance/balanced/economy modes.

export const MODE_TIER_MAP: Record<OperatingMode, Record<ModelRole, ModelTier>> = {
  performance: { chat: 'high', tool: 'high' },
  balanced: { chat: 'high', tool: 'mid' },
  economy: { chat: 'mid', tool: 'low' },
} as const;

// ─── Settings Normalization ─────────────────────────────────────────────────

/**
 * Normalize partial settings into a complete ExtensionSettings object.
 * Fills in defaults for any missing values. Safe to call with empty object.
 */
export function normalizeSettings(partial: Partial<ExtensionSettings>): ExtensionSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...partial,
    modelTiers: {
      ...DEFAULT_SETTINGS.modelTiers,
      ...partial.modelTiers,
    },
    commitConstraints: {
      ...DEFAULT_SETTINGS.commitConstraints,
      ...partial.commitConstraints,
    },
  };
}

// ─── Settings Validation ────────────────────────────────────────────────────

/**
 * Validate a complete settings object. Returns an array of error messages.
 * Empty array = valid.
 */
export function validateSettings(settings: ExtensionSettings): string[] {
  const errors: string[] = [];

  if (!VALID_MODES.includes(settings.mode)) {
    errors.push(`Invalid mode: "${settings.mode}". Must be one of: ${VALID_MODES.join(', ')}`);
  }

  if (!VALID_PROVIDER_SOURCES.includes(settings.providerSource)) {
    errors.push(
      `Invalid providerSource: "${settings.providerSource}". Must be one of: ${VALID_PROVIDER_SOURCES.join(', ')}`,
    );
  }

  if (settings.providerSource === 'direct' && !settings.directApi) {
    errors.push('directApi configuration is required when providerSource is "direct".');
  }

  if (settings.directApi) {
    if (!settings.directApi.apiKey) {
      errors.push('directApi.apiKey must not be empty.');
    }
    if (!['anthropic', 'openai'].includes(settings.directApi.provider)) {
      errors.push(
        `Invalid directApi.provider: "${settings.directApi.provider}". Must be "anthropic" or "openai".`,
      );
    }
  }

  const { commitConstraints: cc } = settings;
  if (cc.minLength < 0) {
    errors.push(`commitConstraints.minLength must be >= 0 (got ${String(cc.minLength)}).`);
  }
  if (cc.maxLength < cc.minLength) {
    errors.push(
      `commitConstraints.maxLength (${String(cc.maxLength)}) must be >= minLength (${String(cc.minLength)}).`,
    );
  }
  if (!['warn', 'deny'].includes(cc.enforcement)) {
    errors.push(
      `commitConstraints.enforcement must be "warn" or "deny" (got "${cc.enforcement}").`,
    );
  }

  for (const lang of settings.enabledLanguages) {
    if (!VALID_LANGUAGES.includes(lang)) {
      errors.push(`Unsupported language: "${lang}". Supported: ${VALID_LANGUAGES.join(', ')}`);
    }
  }

  return errors;
}
