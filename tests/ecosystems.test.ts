/**
 * Ecosystem registry tests (ADR 018) — derivation invariants, legacy-superset
 * guards (the derived lists must cover everything the hand-maintained lists
 * covered before the registry existed), and JVM coverage fixtures.
 */

import { describe, it, expect } from "vitest";
import {
  ECOSYSTEM_PROFILES,
  ECOSYSTEM_ENV_DIRS,
  ECOSYSTEM_CACHE_DIRS,
  ECOSYSTEM_BUILD_DIRS,
  ECOSYSTEM_VENDOR_DIRS,
  ECOSYSTEM_ARTIFACT_EXTS,
  ECOSYSTEM_SOURCE_EXTS,
  ECOSYSTEM_CONFIG_EXTS,
  dirExcludeGlobs,
} from "../src/ecosystems";
import { HYGIENE_SETTINGS, HYGIENE_ANALYTICS_EXCLUDE_PATTERNS } from "../src/constants";
import { categorize, bucketForDirName, ARTIFACT_DIRS } from "../src/domains/hygiene/analytics-utils";

// ============================================================================
// Legacy lists as they existed before the registry (pre-ADR-018 snapshots).
// If a registry edit ever drops one of these, that is a silent exclusion
// regression — the exact failure mode the registry exists to prevent.
// ============================================================================

const LEGACY_SCAN_EXCLUDE_DIRS = [
  "dist", "build", "out", "bundled",
  ".venv", "venv", "__pycache__", ".pytest_cache", ".mypy_cache",
  ".ruff_cache", ".tox", ".eggs",
  "coverage", ".nyc_output", ".cache",
];

const LEGACY_ANALYTICS_EXCLUDE_DIRS = [
  ".venv", "venv", "__pycache__", ".pytest_cache", ".mypy_cache",
  ".ruff_cache", ".tox", ".eggs",
  ".yarn", ".pnpm-store", "vendor", ".bundle", ".gradle",
  ".terraform", ".dart_tool", "deps", ".stack-work", ".cpcache",
  // Documented exceptions (ADR 018): "_build" is a build-output dir —
  // analytics now recurses it for prune candidates like dist/ and target/;
  // "packages" was dropped from the registry entirely — yarn/pnpm monorepos
  // keep first-party source there and excluding it blinded the hygiene scan.
];

const LEGACY_HEAVY_DIRS = [
  "node_modules", "venv", ".venv",
  "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache", ".tox", ".eggs",
  ".yarn", ".pnpm-store", "vendor", ".bundle", ".gradle",
  ".terraform", ".dart_tool", "deps", ".stack-work", ".cpcache",
  // "_build" and "packages" moved out deliberately — see above.
];

const LEGACY_ARTIFACT_EXTS = [".class", ".pyc", ".pyo", ".o", ".obj", ".a", ".so"];
const LEGACY_SOURCE_EXTS = [
  ".ts", ".js", ".py", ".go", ".rs", ".java", ".rb", ".cs", ".tsx", ".jsx", ".sh", ".bash",
];
const LEGACY_CONFIG_EXTS = [".yml", ".yaml", ".json", ".toml", ".ini", ".env"];

describe("ecosystem registry derivation", () => {
  it("dir buckets are pairwise disjoint (a name resolves to exactly one bucket)", () => {
    const buckets = [
      ECOSYSTEM_ENV_DIRS,
      ECOSYSTEM_CACHE_DIRS,
      ECOSYSTEM_BUILD_DIRS,
      ECOSYSTEM_VENDOR_DIRS,
    ];
    for (let i = 0; i < buckets.length; i++) {
      for (let j = i + 1; j < buckets.length; j++) {
        const overlap = [...buckets[i]].filter((n) => buckets[j].has(n));
        expect(overlap).toEqual([]);
      }
    }
  });

  it("source and config extension sets are disjoint", () => {
    const overlap = [...ECOSYSTEM_SOURCE_EXTS].filter((e) => ECOSYSTEM_CONFIG_EXTS.has(e));
    expect(overlap).toEqual([]);
  });

  it("every profile entry is non-empty and extensions carry a leading dot", () => {
    for (const profile of ECOSYSTEM_PROFILES) {
      for (const dir of [
        ...(profile.envDirs ?? []), ...(profile.cacheDirs ?? []),
        ...(profile.buildDirs ?? []), ...(profile.vendorDirs ?? []),
      ]) {
        expect(dir.length).toBeGreaterThan(0);
        expect(dir).not.toContain("/");
      }
      for (const ext of [
        ...(profile.artifactExts ?? []), ...(profile.sourceExts ?? []),
        ...(profile.configExts ?? []),
      ]) {
        expect(ext.startsWith(".")).toBe(true);
      }
    }
  });

  it("dirExcludeGlobs defaults to descendant-only form, deterministically sorted", () => {
    const globs = dirExcludeGlobs([new Set(["b", "a"])]);
    expect(globs).toEqual(["**/a/**", "**/b/**"]);
  });

  it('dirExcludeGlobs "both" adds the dir-path form (analytics walker contract)', () => {
    const globs = dirExcludeGlobs([new Set(["a"])], "both");
    expect(globs).toEqual(["**/a/**", "**/a"]);
  });

  it("scan excludes carry no bare dir-path forms (a FILE named 'dist' is not excluded)", () => {
    for (const pattern of HYGIENE_SETTINGS.EXCLUDE_PATTERNS) {
      if (pattern.startsWith("**/") && !pattern.includes(".egg-info")) {
        expect(pattern.endsWith("/**")).toBe(true);
      }
    }
  });
});

describe("legacy-superset guards (no silent exclusion regressions)", () => {
  it("hygiene scan excludes cover every legacy scan-exclude dir", () => {
    for (const dir of LEGACY_SCAN_EXCLUDE_DIRS) {
      expect(HYGIENE_SETTINGS.EXCLUDE_PATTERNS).toContain(`**/${dir}/**`);
    }
    expect(HYGIENE_SETTINGS.EXCLUDE_PATTERNS).toContain("**/*.egg-info/**");
  });

  it("analytics excludes cover every legacy analytics-exclude dir", () => {
    for (const dir of LEGACY_ANALYTICS_EXCLUDE_DIRS) {
      expect(HYGIENE_ANALYTICS_EXCLUDE_PATTERNS).toContain(`**/${dir}/**`);
    }
    expect(HYGIENE_ANALYTICS_EXCLUDE_PATTERNS).toContain("**/*.egg-info/**");
  });

  it("analytics excludes do NOT exclude build-output dirs (recursed for prune candidates)", () => {
    for (const dir of ECOSYSTEM_BUILD_DIRS) {
      expect(HYGIENE_ANALYTICS_EXCLUDE_PATTERNS).not.toContain(`**/${dir}/**`);
    }
  });

  it("heavy/placeholder membership (env∪cache∪vendor) covers every legacy heavy dir", () => {
    const heavy = new Set([
      ...ECOSYSTEM_ENV_DIRS, ...ECOSYSTEM_CACHE_DIRS, ...ECOSYSTEM_VENDOR_DIRS,
    ]);
    for (const dir of LEGACY_HEAVY_DIRS) {
      expect(heavy.has(dir), `missing heavy dir: ${dir}`).toBe(true);
    }
  });

  it("categorization ext sets cover every legacy ext", () => {
    for (const ext of LEGACY_ARTIFACT_EXTS) expect(ECOSYSTEM_ARTIFACT_EXTS.has(ext)).toBe(true);
    for (const ext of LEGACY_SOURCE_EXTS) expect(ECOSYSTEM_SOURCE_EXTS.has(ext)).toBe(true);
    for (const ext of LEGACY_CONFIG_EXTS) expect(ECOSYSTEM_CONFIG_EXTS.has(ext)).toBe(true);
  });
});

describe("JVM coverage (the enterprise-footprint gap ADR 018 closes)", () => {
  it("Maven target/ is excluded from the hygiene scan", () => {
    expect(HYGIENE_SETTINGS.EXCLUDE_PATTERNS).toContain("**/target/**");
  });

  it("Gradle and Kotlin caches are excluded and bucketed as caches", () => {
    for (const dir of [".gradle", ".kotlin"]) {
      expect(HYGIENE_SETTINGS.EXCLUDE_PATTERNS).toContain(`**/${dir}/**`);
      expect(bucketForDirName(dir)).toBe("caches");
    }
  });

  it("target/ buckets as a build output and its contents categorize as artifact", () => {
    expect(bucketForDirName("target")).toBe("buildOutputs");
    expect(ARTIFACT_DIRS.has("target")).toBe(true);
  });

  it("packaged JVM outputs categorize as artifact", () => {
    for (const ext of [".class", ".jar", ".war", ".ear", ".hprof"]) {
      expect(categorize(ext, `app${ext}`, `libs/app${ext}`)).toBe("artifact");
    }
  });

  it("JVM-family sources categorize as source", () => {
    for (const ext of [".java", ".kt", ".kts", ".scala", ".groovy"]) {
      expect(categorize(ext, `Main${ext}`, `src/Main${ext}`)).toBe("source");
    }
  });

  it("pom.xml and application.properties categorize as config, not other", () => {
    expect(categorize(".xml", "pom.xml", "pom.xml")).toBe("config");
    expect(categorize(".properties", "application.properties", "src/main/resources/application.properties")).toBe("config");
    expect(categorize(".gradle", "build.gradle", "build.gradle")).toBe("config");
  });

  it("bare bin/ is deliberately NOT excluded (documented false-positive tradeoff)", () => {
    expect(HYGIENE_SETTINGS.EXCLUDE_PATTERNS).not.toContain("**/bin/**");
    expect(bucketForDirName("bin")).toBeNull();
  });

  it("packages/ is deliberately NOT excluded (yarn/pnpm monorepo first-party source)", () => {
    expect(HYGIENE_SETTINGS.EXCLUDE_PATTERNS).not.toContain("**/packages/**");
    expect(HYGIENE_ANALYTICS_EXCLUDE_PATTERNS).not.toContain("**/packages/**");
    expect(bucketForDirName("packages")).toBeNull();
  });
});
