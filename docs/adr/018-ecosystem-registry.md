# ADR 018 — Ecosystem Registry: Single Source for Language/Toolchain Semantics

**Date:** 2026-07-03
**Status:** Accepted

## Context

Meridian's knowledge of language ecosystems — which directory names are
environments, caches, build outputs, or vendored dependencies, and which file
extensions are sources, configs, or compiled artifacts — was spread across
five independently hand-maintained lists in two files:

1. `HYGIENE_SETTINGS.EXCLUDE_PATTERNS` (constants.ts) — hygiene scan exclusions
2. `HYGIENE_ANALYTICS_EXCLUDE_PATTERNS` (constants.ts) — analytics walker exclusions
3. `HEAVY_ARTIFACT_DIRS` (hygiene/analytics-service.ts) — never-recurse placeholder dirs
4. `COLLECTION_BUCKETS` (hygiene/analytics-utils.ts) — Collections bucketing
5. `ARTIFACT_EXTS` / `ARTIFACT_DIRS` / `SOURCE_EXTS` / `CONFIG_EXTS` (analytics-utils.ts) — categorization

The lists had already drifted: `.gradle` appeared in 2 and 4 but not 1;
`target` in 4 and 5 but not 1 or 2. The practical consequence was a
**JVM-shaped hole**: pointing the hygiene scan at a Maven repository descended
into `target/` and flooded candidates with `.class` files; `pom.xml` and
`application.properties` categorized as "other"; `.jar`/`.war` were not
artifacts. The tested stacks (Python, JS/TS) were rich; the enterprise Java
footprint was effectively unsupported.

## Decision

1. **`src/ecosystems.ts` is the single source of ecosystem semantics.** It
   declares `EcosystemProfile` entries (`envDirs`, `cacheDirs`, `buildDirs`,
   `vendorDirs`, `artifactExts`, `sourceExts`, `configExts`) per ecosystem
   (common, node, python, jvm, go, rust, dotnet, ruby, elixir, native,
   terraform, dart, haskell, clojure). The module imports nothing, so every
   layer — including `constants.ts` — can consume it without cycles. Adding
   ecosystem coverage is one profile entry; consumer lists are never edited.

2. **All five former lists are derived unions.** Derivation semantics:
   - Hygiene scan excludes = base + env ∪ cache ∪ vendor ∪ build (the scan
     hunts stray files, not generated-tree contents).
   - Analytics excludes = base + env ∪ cache ∪ vendor. Build dirs are
     **recursed** so contents surface as prune candidates.
   - Heavy/placeholder dirs = env ∪ cache ∪ vendor — definitionally identical
     to the analytics exclusion set, so exclusion and placeholder membership
     cannot drift apart.
   - Collections buckets map 1:1 to the four dir kinds.
   - `ARTIFACT_DIRS` (categorization) = env ∪ cache ∪ build; vendor dirs are
     never recursed, so their contents never reach `categorize()`.

3. **Suffix-matched names stay literal.** `*.egg-info` cannot be expressed in
   a name-keyed registry; the glob in `constants.ts` and the `endsWith` check
   in the analytics walker remain special cases, documented at both sites.

4. **JVM profile.** `target` (build); `.gradle`, `.kotlin`, `.bloop`,
   `.metals` (caches); `.class`, `.jar`, `.war`, `.ear`, `.hprof` (artifacts);
   `.java`, `.kt`, `.kts`, `.scala`, `.groovy` (sources); `.xml`,
   `.properties`, `.gradle` (configs). Eclipse `.settings/` joins
   `WORKSPACE_EXCLUDE_BASE` as IDE metadata (same class as `.idea`/`.vscode`).

5. **Deliberate omissions.** Bare `bin/` is NOT excluded or bucketed — script
   `bin/` dirs with real source are common, and the false-positive cost
   outweighs the Eclipse/.NET benefit. `packages/` is likewise omitted
   entirely (revised in the production-readiness pass): yarn/pnpm monorepos
   keep first-party source there, and silently blinding the hygiene scan to
   it costs more than legacy NuGet layouts gain — NuGet shops opt back out
   via `.meridianignore`. `obj/` (dotnet) IS excluded (the name is
   toolchain-specific enough). `env/` IS excluded — kept for parity with
   venv detection; a first-party `env/` dir is rarer than a virtualenv named
   `env`, and `.meridianignore` remains the escape hatch. All pinned by test.

6. **Glob forms are per-consumer.** `dirExcludeGlobs(sets, form)` emits
   descendant-only globs (`**/<dir>/**`) by default — the hygiene scan
   matches file paths, and the bare form would wrongly exclude a *file*
   named `dist` or `deps`. The analytics walker requests `"both"` because it
   pattern-matches directory paths themselves to stop recursion and emit the
   placeholder row. Side effect worth naming: pre-registry, the Python heavy
   dirs lacked bare forms in the analytics list, so the walker recursed one
   readdir level into every venv and emitted no placeholder for it — the
   uniform derivation fixed that latent inconsistency.

## Intended behavior changes

All strictly toward correctness; guarded by legacy-superset tests in
`tests/ecosystems.test.ts` (every pre-registry pattern must appear in the
derived sets, with documented exceptions):

- The hygiene scan now excludes `target/`, `.gradle/`, `.yarn/`, `vendor/`,
  `deps/`, `_build/`, `packages/`, `.terraform/`, etc. (previously flooded).
- Files under build-output dirs (`dist/`, `target/`, `_build/`, …) categorize
  as `artifact`, making aged build products prune candidates — the
  generalized form of the Java `target/` fix.
- `_build/` (Elixir) is no longer analytics-excluded: as a build dir it is
  now recursed for prune candidates, consistent with `dist/` and `target/`.
- `deps/` reclassifies from buildOutputs to vendoredDeps (Mix deps are
  fetched packages); `packages/` leaves the registry entirely (see
  decision 5) — it is no longer analytics-excluded, heavy-placeholdered,
  or bucketed.
- New cache coverage: `coverage/`, `.nyc_output/`, `.next/`, `.nuxt/`,
  `.parcel-cache/`, `.kotlin/`, `.bloop/`, `.metals/` now excluded and
  placeholdered everywhere, not just in whichever list happened to have them.

## Alternatives considered

**Flat, better-commented union sets (no profiles).** Delivers the same
anti-drift derivation with slightly less structure, but re-creates
drift-within-file (a new ecosystem still edits seven sets) and cannot be
fixture-tested per ecosystem. Rejected.

**Per-ecosystem enable/disable setting.** No demonstrated need; exclusion
supersets are cheap and harmless on repos that lack the dirs. Rejected as
speculative surface (YAGNI).

**Registry in `src/domains/hygiene/`.** Rejected: `constants.ts` must consume
it, and constants → domains would invert layering.

## Consequences

- **Positive.** Drift is structurally impossible; JVM repos are first-class;
  future ecosystems are one-entry additions with a fixture-test pattern to
  copy. Exclusion lists, placeholders, buckets, and categorization can no
  longer disagree.
- **Cost.** One more top-level module. Derived globs are marginally broader
  than the old hand lists (more dirs excluded) — this is the point, but it
  does mean scan results change on repos that previously surfaced
  generated-tree noise.
- **Cross-references:** ADR 014 (dotdir doctrine — `.meridian` remains in the
  walker's skip set), `tests/ecosystems.test.ts` (superset + disjointness +
  JVM fixtures).
