/**
 * Domain-shaped accessor for hygiene prune config, layered over the generic
 * settings.ts registry. Keeps infrastructure/settings.ts free of any
 * domain-specific shape.
 */

import { readSetting } from "../../infrastructure/settings";
import { PruneConfig, FileCategory } from "./analytics-types";

export function getPruneConfig(): PruneConfig {
  return {
    minAgeDays:   readSetting("hygiene.prune.minAgeDays"),
    maxSizeMB:    readSetting("hygiene.prune.maxSizeMB"),
    minLineCount: readSetting("hygiene.prune.minLineCount"),
    categories:   [...readSetting("hygiene.prune.categories")] as FileCategory[],
  };
}
