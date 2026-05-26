# ADR 015 — Ignore Pattern Semantics

**Date:** 2026-05-26
**Status:** Accepted

## Context

`.meridian/.meridianignore` (ADR 014) and `.gitignore` are both parsed by
the same reader (`readIgnoreFilePatterns` in `src/security/ignore-store.ts`).
The reader emits glob patterns that are then matched against workspace paths
in three consumers: git analytics, hygiene analytics, hygiene scan.

Two real-world bugs surfaced from the original implementation:

1. **Dotfile blind spot.** Every `micromatch.isMatch` call site used the
   library default `dot: false`, which silently excludes paths whose final
   segment begins with `.`. The baseline `**/node_modules/**` exclude never
   actually matched `node_modules/.package-lock.json` and similar entries.
   Six call sites, one missing option each.

2. **Bare-entry under-expansion.** A user adding `node_modules` to the
   ignore file got a single pattern `**/node_modules` emitted, which matches
   only the directory entry itself, never its children — diverging from
   gitignore semantics that users assume.

The fix introduces a single match chokepoint and a stricter pattern
contract. This ADR records the contract so it does not get re-broken.

## Decision

1. **Match-time policy lives in one place.** `src/infrastructure/glob-match.ts`
   exports `pathMatchesAny(path, patterns)`. Every glob match in the
   codebase routes through it. The helper always passes `{ dot: true }` so
   dotfiles are considered. New call sites that need glob matching MUST
   use this helper — direct `micromatch.isMatch` is forbidden in
   `src/domains/**` and `src/security/**`.

2. **Pattern parsing produces both an entry pattern and a children pattern.**
   Every line in `.meridianignore` / `.gitignore` (other than blanks,
   comments, and negation lines) expands to two patterns at read time —
   the entry itself and `<entry>/**` — so a directory-shaped name covers
   its contents. Documented per-line transforms:

   | Input          | Emitted                            |
   |----------------|------------------------------------|
   | `# comment`    | dropped                            |
   | blank          | dropped                            |
   | `!foo`         | dropped (negation unsupported)     |
   | `/foo`         | `foo`, `foo/**` (root-anchored)    |
   | `/foo/`        | `foo`, `foo/**` (root-anchored)    |
   | `**/foo`       | `**/foo`, `**/foo/**`              |
   | `foo`          | `**/foo`, `**/foo/**`              |
   | `foo/`         | `**/foo`, `**/foo/**`              |

3. **Negation (`!foo`) is intentionally out of scope.** Honest negation
   requires order-aware evaluation across the whole pattern set. The reader
   silently drops `!`-prefixed lines; documented in the function JSDoc.
   If a user needs allow-list semantics, write narrower exclude patterns.

4. **Exclude patterns are workspace-relative.** Consumers test paths in
   workspace-relative form only. Absolute-path branches in walkers have
   been removed (e.g. `hygiene/analytics-service.ts` dropped its
   `pathMatchesAny(fullPath, …)` defensive branch). All patterns emitted
   by the reader are either `**/`-prefixed (match-anywhere) or
   root-anchored bare names — both forms match against relative paths
   correctly.

## Consequences

- `.gitignore` reading benefits from the same fixes for free, since both
  files share `readIgnoreFilePatterns`.
- The user `--path` filter in git analytics now includes dotfiles (e.g.
  `--path=src/**` matches `src/.tsbuildinfo`). This is a behavior change
  beyond the stated bug scope; almost certainly the more correct default.
- Pattern array roughly doubles vs the prior emission. Negligible at
  typical sizes; if profiling ever shows compile cost is the bottleneck,
  introduce a `compileMatcher(patterns)` factory in `glob-match.ts` and
  hoist out of hot loops — explicitly not done in v1.
- `compileMatcher`-style hoisting is the next step if the matcher loops
  ever become a perf concern; not pre-built because the surface to
  benchmark first does not exist yet.

## References

- `src/infrastructure/glob-match.ts` — `pathMatchesAny`
- `src/security/ignore-store.ts` — `readIgnoreFilePatterns`
- `tests/ignoreStore.test.ts`, `tests/excludeFiltering.test.ts` — contract pins
- ADR 014 — `.meridian/` dotdir doctrine (parent)
