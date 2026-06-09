/**
 * Git path helpers — pure, no I/O.
 */

/**
 * Normalize git's rename notation in a `--numstat` path to the destination
 * path:
 *
 *   Brace form:  "src/{old.ts => new.ts}" → "src/new.ts"
 *   Simple form: "old.ts => new.ts"       → "new.ts"
 *   No rename:   "src/a.ts"               → "src/a.ts"
 *
 * Extracted verbatim from the analytics numstat parser so that the analytics
 * `FileMetric.path` and the pending-change-risk dirty-set join
 * (`session-aggregator`) share ONE source of truth — a silent divergence here
 * would break the join (the dirty-set side is otherwise not rename-normalized,
 * while the analytics side always is).
 */
export function normalizeRenamePath(raw: string): string {
  if (!raw.includes(" => ")) return raw;
  return raw.includes("{")
    ? raw.replace(/\{[^}]* => ([^}]*)\}/g, "$1")
    : raw.split(" => ").pop()!;
}
