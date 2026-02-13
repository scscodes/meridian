import type { OperatingMode, ModelRole, ModelTier, ModelTierMap } from '../types/index.js';
import { MODE_TIER_MAP } from '../settings/schema.js';

/**
 * Resolve which model tier to use for a given role under the current mode.
 *
 * @example
 * resolveTier('balanced', 'chat') // → 'high'
 * resolveTier('balanced', 'tool') // → 'mid'
 * resolveTier('economy', 'chat')  // → 'mid'
 */
export function resolveTier(mode: OperatingMode, role: ModelRole): ModelTier {
  return MODE_TIER_MAP[mode][role];
}

/**
 * Resolve the concrete model identifier for a given mode and role.
 * Looks up the tier, then returns the user-configured model for that tier.
 *
 * @returns The model identifier string, or empty string if not configured.
 */
export function resolveModelId(
  mode: OperatingMode,
  role: ModelRole,
  tierMap: ModelTierMap,
): string {
  const tier = resolveTier(mode, role);
  return tierMap[tier];
}
