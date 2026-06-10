/**
 * Domain-shaped accessor for hygiene prune config, layered over the generic
 * settings.ts registry. Keeps infrastructure/settings.ts free of any
 * domain-specific shape.
 */

import { readSetting } from "../../infrastructure/settings";
import { PruneConfig, FileCategory } from "./analytics-types";

const VALID_CATEGORIES: ReadonlySet<string> = new Set<FileCategory>([
  "markdown", "log", "config", "backup", "temp", "source", "artifact", "other",
]);

export function getPruneConfig(): PruneConfig {
  return {
    minAgeDays:   readSetting("hygiene.prune.minAgeDays"),
    maxSizeMB:    readSetting("hygiene.prune.maxSizeMB"),
    minLineCount: readSetting("hygiene.prune.minLineCount"),
    // VS Code does not enforce enum membership on user-supplied values;
    // narrow here so unknown strings never enter the typed config.
    categories:   readSetting("hygiene.prune.categories")
      .filter((c): c is FileCategory => VALID_CATEGORIES.has(c)),
  };
}
