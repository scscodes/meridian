/**
 * Single chokepoint for glob matching across meridian (ADR 015).
 *
 * `{ dot: true }` is always on — micromatch's default skips dotfiles, which
 * silently bypasses excludes for `node_modules/.package-lock.json`, `.bin/foo`,
 * and similar. Empty pattern arrays short-circuit to false.
 */
import micromatch from "micromatch";

export function pathMatchesAny(p: string, patterns: string | string[]): boolean {
  if (Array.isArray(patterns) && patterns.length === 0) return false;
  return micromatch.isMatch(p, patterns, { dot: true });
}
