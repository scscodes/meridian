import { describe, it, expect } from "vitest";
import {
  buildCollections,
  buildTemporalData,
  categorize,
  findDuplicateBasenames,
  isLineCountable,
  isPruneCandidate,
  lastNDays,
  sumLinesByCategory,
} from "../src/domains/hygiene/analytics-utils";
import { HygieneFileEntry, PRUNE_DEFAULTS } from "../src/domains/hygiene/analytics-types";

const mkFile = (overrides: Partial<HygieneFileEntry>): HygieneFileEntry => ({
  path: "src/file.ts",
  name: "file.ts",
  extension: ".ts",
  category: "source",
  sizeBytes: 100,
  lastModified: new Date(),
  ageDays: 0,
  lineCount: 10,
  isPruneCandidate: false,
  ...overrides,
});

describe("categorize", () => {
  it("classifies .pyc as artifact", () => {
    expect(categorize(".pyc", "mod.pyc", "lib/mod.pyc")).toBe("artifact");
  });

  it("classifies .js inside target/ as artifact", () => {
    expect(categorize(".js", "bundle.js", "target/bundle.js")).toBe("artifact");
  });

  it("classifies .egg-info dir contents as artifact", () => {
    expect(categorize(".txt", "top_level.txt", "foo.egg-info/top_level.txt")).toBe("artifact");
  });

  it("classifies .md as markdown", () => {
    expect(categorize(".md", "README.md", "README.md")).toBe("markdown");
  });

  it("classifies .log as log", () => {
    expect(categorize(".log", "app.log", "logs/app.log")).toBe("log");
  });

  it("classifies .json as config", () => {
    expect(categorize(".json", "tsconfig.json", "tsconfig.json")).toBe("config");
  });

  it("classifies .bak as backup", () => {
    expect(categorize(".bak", "file.bak", "file.bak")).toBe("backup");
  });

  it("classifies tilde-suffixed as backup", () => {
    expect(categorize(".ts", "file.ts~", "file.ts~")).toBe("backup");
  });

  it("classifies .tmp as temp", () => {
    expect(categorize(".tmp", "data.tmp", "data.tmp")).toBe("temp");
  });

  it("classifies .ts as source", () => {
    expect(categorize(".ts", "main.ts", "src/main.ts")).toBe("source");
  });

  it("classifies unknown extension as other", () => {
    expect(categorize(".xyz", "file.xyz", "file.xyz")).toBe("other");
  });
});

describe("isPruneCandidate", () => {
  it("returns false when age below threshold", () => {
    expect(isPruneCandidate(5, "log", 100, -1, PRUNE_DEFAULTS)).toBe(false);
  });

  it("returns true for matching category with sufficient age", () => {
    expect(isPruneCandidate(60, "log", 100, -1, PRUNE_DEFAULTS)).toBe(true);
  });

  it("returns true for oversized file with sufficient age", () => {
    const config = { ...PRUNE_DEFAULTS, maxSizeMB: 1 };
    expect(isPruneCandidate(60, "source", 2 * 1_048_576, -1, config)).toBe(true);
  });

  it("returns true for high line count with sufficient age", () => {
    const config = { ...PRUNE_DEFAULTS, minLineCount: 500 };
    expect(isPruneCandidate(60, "source", 100, 600, config)).toBe(true);
  });

  it("returns false when minLineCount is 0", () => {
    const config = { ...PRUNE_DEFAULTS, minLineCount: 0 };
    // No category match, no size match, lineCount check skipped when minLineCount is 0
    expect(isPruneCandidate(60, "source", 100, 9999, config)).toBe(false);
  });
});

describe("isLineCountable", () => {
  it("returns true for .ts under threshold", () => {
    expect(isLineCountable(".ts", 1000)).toBe(true);
  });

  it("returns false for .ts over 5 MB", () => {
    expect(isLineCountable(".ts", 6 * 1024 * 1024)).toBe(false);
  });

  it("returns false for non-text extension", () => {
    expect(isLineCountable(".png", 1000)).toBe(false);
  });
});

describe("lastNDays", () => {
  it("returns N days, oldest first", () => {
    const days = lastNDays(3);
    expect(days).toHaveLength(3);
    expect(days[0].start).toBeLessThan(days[1].start);
    expect(days[1].start).toBeLessThan(days[2].start);
  });

  it("day end equals next day start", () => {
    const days = lastNDays(2);
    expect(days[0].end).toBe(days[1].start);
  });
});

describe("buildTemporalData", () => {
  it("returns 14 buckets with topExtensions", () => {
    const result = buildTemporalData([]);
    expect(result.buckets).toHaveLength(14);
    expect(result.topExtensions).toEqual([]);
  });

  it("counts files into correct daily bucket", () => {
    const now = new Date();
    now.setHours(12, 0, 0, 0); // mid-day today
    const files: HygieneFileEntry[] = [
      {
        path: "src/a.ts",
        name: "a.ts",
        extension: ".ts",
        category: "source",
        sizeBytes: 100,
        lastModified: now,
        ageDays: 0,
        lineCount: 10,
        isPruneCandidate: false,
      },
    ];
    const result = buildTemporalData(files);
    const todayBucket = result.buckets[result.buckets.length - 1];
    expect(todayBucket.total).toBe(1);
  });

  it("tracks dead code counts when provided", () => {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    const files: HygieneFileEntry[] = [
      {
        path: "src/a.ts",
        name: "a.ts",
        extension: ".ts",
        category: "source",
        sizeBytes: 100,
        lastModified: now,
        ageDays: 0,
        lineCount: 10,
        isPruneCandidate: false,
      },
    ];
    const deadCodeMap = new Map([["src/a.ts", 3]]);
    const result = buildTemporalData(files, deadCodeMap);
    const todayBucket = result.buckets[result.buckets.length - 1];
    expect(todayBucket.deadCodeCount).toBe(3);
  });
});

describe("buildCollections", () => {
  it("buckets .venv as envs", () => {
    const files = [
      mkFile({ path: ".venv", name: ".venv", category: "artifact", sizeBytes: 0, lineCount: -1 }),
    ];
    expect(buildCollections(files).envs).toEqual([".venv"]);
  });

  it("buckets __pycache__ as caches", () => {
    const files = [
      mkFile({ path: "lib/__pycache__", name: "__pycache__", category: "artifact", sizeBytes: 0, lineCount: -1 }),
    ];
    expect(buildCollections(files).caches).toEqual(["lib/__pycache__"]);
  });

  it("buckets dist/ contents as buildOutputs via path segments", () => {
    const files = [
      mkFile({ path: "dist/bundle.js", name: "bundle.js" }),
      mkFile({ path: "dist/bundle.js.map", name: "bundle.js.map" }),
    ];
    expect(buildCollections(files).buildOutputs).toEqual(["dist"]);
  });

  it("buckets node_modules as vendoredDeps", () => {
    const files = [
      mkFile({ path: "node_modules", name: "node_modules", category: "artifact", sizeBytes: 0, lineCount: -1 }),
    ];
    expect(buildCollections(files).vendoredDeps).toEqual(["node_modules"]);
  });

  it("deduplicates the same dir across multiple files", () => {
    const files = [
      mkFile({ path: "build/a.js", name: "a.js" }),
      mkFile({ path: "build/b.js", name: "b.js" }),
      mkFile({ path: "build/sub/c.js", name: "c.js" }),
    ];
    expect(buildCollections(files).buildOutputs).toEqual(["build"]);
  });

  it("captures multiple distinct collection dirs separately", () => {
    const files = [
      mkFile({ path: "server/.venv", name: ".venv", category: "artifact", sizeBytes: 0, lineCount: -1 }),
      mkFile({ path: "client/.venv", name: ".venv", category: "artifact", sizeBytes: 0, lineCount: -1 }),
    ];
    expect(buildCollections(files).envs).toEqual(["client/.venv", "server/.venv"]);
  });

  it("claims outermost match when collection dirs nest", () => {
    const files = [
      mkFile({ path: "node_modules/some-pkg/dist/index.js", name: "index.js" }),
    ];
    const result = buildCollections(files);
    expect(result.vendoredDeps).toEqual(["node_modules"]);
    expect(result.buildOutputs).toEqual([]);
  });

  it("returns empty arrays for files with no collection segments", () => {
    const files = [
      mkFile({ path: "src/app.ts", name: "app.ts" }),
      mkFile({ path: "README.md", name: "README.md", category: "markdown" }),
    ];
    const result = buildCollections(files);
    expect(result.envs).toEqual([]);
    expect(result.caches).toEqual([]);
    expect(result.buildOutputs).toEqual([]);
    expect(result.vendoredDeps).toEqual([]);
  });
});

describe("findDuplicateBasenames", () => {
  it("returns groups meeting the default min-3 floor", () => {
    const files = [
      mkFile({ path: "a/index.ts", name: "index.ts" }),
      mkFile({ path: "b/index.ts", name: "index.ts" }),
      mkFile({ path: "c/index.ts", name: "index.ts" }),
      mkFile({ path: "only/once.ts", name: "once.ts" }),
    ];
    const result = findDuplicateBasenames(files);
    expect(result).toHaveLength(1);
    expect(result[0].basename).toBe("index.ts");
    expect(result[0].count).toBe(3);
    expect(result[0].paths).toEqual(["a/index.ts", "b/index.ts", "c/index.ts"]);
  });

  it("respects a custom minOccurrences threshold", () => {
    const files = [
      mkFile({ path: "a/utils.ts", name: "utils.ts" }),
      mkFile({ path: "b/utils.ts", name: "utils.ts" }),
    ];
    expect(findDuplicateBasenames(files, 2)).toHaveLength(1);
    expect(findDuplicateBasenames(files, 3)).toHaveLength(0);
  });

  it("sorts by count desc, then basename asc", () => {
    const files = [
      mkFile({ path: "a/foo.ts", name: "foo.ts" }),
      mkFile({ path: "b/foo.ts", name: "foo.ts" }),
      mkFile({ path: "c/foo.ts", name: "foo.ts" }),
      mkFile({ path: "a/zap.ts", name: "zap.ts" }),
      mkFile({ path: "b/zap.ts", name: "zap.ts" }),
      mkFile({ path: "c/zap.ts", name: "zap.ts" }),
      mkFile({ path: "d/zap.ts", name: "zap.ts" }),
    ];
    const result = findDuplicateBasenames(files);
    expect(result.map((r) => r.basename)).toEqual(["zap.ts", "foo.ts"]);
  });

  it("ignores placeholder directory rows", () => {
    const files = [
      mkFile({ path: "a/.venv", name: ".venv", category: "artifact", sizeBytes: 0, lineCount: -1 }),
      mkFile({ path: "b/.venv", name: ".venv", category: "artifact", sizeBytes: 0, lineCount: -1 }),
      mkFile({ path: "c/.venv", name: ".venv", category: "artifact", sizeBytes: 0, lineCount: -1 }),
    ];
    expect(findDuplicateBasenames(files)).toHaveLength(0);
  });
});

describe("sumLinesByCategory", () => {
  it("sums lineCount per category", () => {
    const files = [
      mkFile({ category: "source", lineCount: 100 }),
      mkFile({ category: "source", lineCount: 50 }),
      mkFile({ category: "markdown", lineCount: 30 }),
    ];
    const result = sumLinesByCategory(files);
    expect(result.source).toBe(150);
    expect(result.markdown).toBe(30);
  });

  it("skips files with lineCount <= 0", () => {
    const files = [
      mkFile({ category: "source", lineCount: 100 }),
      mkFile({ category: "source", lineCount: -1 }),
      mkFile({ category: "artifact", lineCount: 0, sizeBytes: 0 }),
    ];
    const result = sumLinesByCategory(files);
    expect(result.source).toBe(100);
    expect(result.artifact).toBeUndefined();
  });

  it("returns empty object for no countable files", () => {
    expect(sumLinesByCategory([])).toEqual({});
  });
});
