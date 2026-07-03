/**
 * Ecosystem Registry — single source of truth for language/toolchain
 * semantics: which directory names are environments, caches, build outputs,
 * or vendored dependencies, and which file extensions are sources, configs,
 * or compiled artifacts.
 *
 * Every exclusion list, collection bucket, and categorization set that used
 * to be hand-maintained (and drifted) across constants.ts,
 * hygiene/analytics-utils.ts, and hygiene/analytics-service.ts is DERIVED
 * from this registry (ADR 018). Adding ecosystem coverage is one profile
 * entry here — never an edit to a consumer list.
 *
 * Bucket semantics:
 * - envDirs     — local interpreter/runtime environments (never recurse).
 * - cacheDirs   — regenerable tool caches and coverage output (never recurse).
 * - vendorDirs  — fetched third-party dependencies (never recurse).
 * - buildDirs   — compiled/build output. Excluded from the hygiene scan, but
 *                 RECURSED by hygiene analytics so contents surface as prune
 *                 candidates (see constants.ts HYGIENE_ANALYTICS_EXCLUDE_PATTERNS).
 *
 * Deliberately omitted dir names (ADR 018): bare `bin` (legit script dirs are
 * common; Eclipse/.NET bin output is not worth the false-positive rate);
 * `packages` (yarn/pnpm monorepos keep first-party source there — silently
 * blinding the hygiene scan to it costs more than legacy NuGet layouts gain;
 * NuGet shops can opt out via .meridianignore); and `.mvn` /
 * `.settings`-style committed project config (IDE metadata lives in
 * WORKSPACE_EXCLUDE_BASE instead).
 *
 * This module imports nothing so any layer — including constants.ts — can
 * consume it without cycles.
 */

export interface EcosystemProfile {
  readonly name: string;
  readonly envDirs?: readonly string[];
  readonly cacheDirs?: readonly string[];
  readonly buildDirs?: readonly string[];
  readonly vendorDirs?: readonly string[];
  readonly artifactExts?: readonly string[];
  readonly sourceExts?: readonly string[];
  readonly configExts?: readonly string[];
}

export const ECOSYSTEM_PROFILES: readonly EcosystemProfile[] = [
  {
    // Cross-ecosystem conventions that no single toolchain owns.
    name: "common",
    cacheDirs: [".cache", "coverage", ".nyc_output"],
    buildDirs: ["dist", "build", "out", "bundled"],
    sourceExts: [".sh", ".bash"],
    configExts: [".json", ".yml", ".yaml", ".env"],
  },
  {
    name: "node",
    cacheDirs: [".yarn", ".pnpm-store", ".next", ".nuxt", ".parcel-cache"],
    vendorDirs: ["node_modules"],
    sourceExts: [".ts", ".tsx", ".js", ".jsx"],
  },
  {
    name: "python",
    envDirs: ["venv", ".venv", "env"],
    cacheDirs: ["__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache", ".tox", ".eggs"],
    artifactExts: [".pyc", ".pyo"],
    sourceExts: [".py"],
    configExts: [".toml", ".ini"],
  },
  {
    // Java / Kotlin / Scala / Groovy — Maven, Gradle, sbt toolchains.
    name: "jvm",
    cacheDirs: [".gradle", ".kotlin", ".bloop", ".metals"],
    buildDirs: ["target"],
    artifactExts: [".class", ".jar", ".war", ".ear", ".hprof"],
    sourceExts: [".java", ".kt", ".kts", ".scala", ".groovy"],
    configExts: [".xml", ".properties", ".gradle"],
  },
  {
    name: "go",
    vendorDirs: ["vendor"],
    sourceExts: [".go"],
  },
  {
    // `target` is shared with jvm/Maven — the set union deduplicates.
    name: "rust",
    buildDirs: ["target"],
    sourceExts: [".rs"],
  },
  {
    name: "dotnet",
    buildDirs: ["obj"],
    sourceExts: [".cs"],
  },
  {
    name: "ruby",
    vendorDirs: [".bundle"],
    sourceExts: [".rb"],
  },
  {
    name: "elixir",
    buildDirs: ["_build"],
    vendorDirs: ["deps"],
  },
  {
    name: "native",
    artifactExts: [".o", ".obj", ".a", ".so"],
  },
  { name: "terraform", cacheDirs: [".terraform"] },
  { name: "dart", cacheDirs: [".dart_tool"] },
  { name: "haskell", cacheDirs: [".stack-work"] },
  { name: "clojure", cacheDirs: [".cpcache"] },
];

function unionOf(pick: (p: EcosystemProfile) => readonly string[] | undefined): ReadonlySet<string> {
  const out = new Set<string>();
  for (const profile of ECOSYSTEM_PROFILES) {
    for (const entry of pick(profile) ?? []) out.add(entry);
  }
  return out;
}

export const ECOSYSTEM_ENV_DIRS = unionOf((p) => p.envDirs);
export const ECOSYSTEM_CACHE_DIRS = unionOf((p) => p.cacheDirs);
export const ECOSYSTEM_BUILD_DIRS = unionOf((p) => p.buildDirs);
export const ECOSYSTEM_VENDOR_DIRS = unionOf((p) => p.vendorDirs);

export const ECOSYSTEM_ARTIFACT_EXTS = unionOf((p) => p.artifactExts);
export const ECOSYSTEM_SOURCE_EXTS = unionOf((p) => p.sourceExts);
export const ECOSYSTEM_CONFIG_EXTS = unionOf((p) => p.configExts);

// Exclusion globs for a group of dir-name sets, sorted for determinism.
// Two forms exist because consumers match different path kinds:
// - "descendants" — only "**/<dir>/**". For file-path matchers (the hygiene
//   scan): excludes contents without accidentally excluding a FILE that
//   happens to be named "dist" or "deps".
// - "both" — adds the dir-path form "**/<dir>". For the analytics walker,
//   which pattern-matches directory paths themselves to stop recursion and
//   emit the single placeholder row.
export function dirExcludeGlobs(
  sets: ReadonlyArray<ReadonlySet<string>>,
  form: "descendants" | "both" = "descendants"
): readonly string[] {
  const names = new Set<string>();
  for (const set of sets) for (const name of set) names.add(name);
  return [...names]
    .sort()
    .flatMap((name) =>
      form === "both" ? [`**/${name}/**`, `**/${name}`] : [`**/${name}/**`]
    );
}
