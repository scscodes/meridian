import { describe, it, expect } from "vitest";
import {
  categorize,
  isPruneCandidate,
  isLineCountable,
  buildTemporalData,
  lastNDays,
} from "../src/domains/hygiene/analytics-utils";
import { HygieneFileEntry, PRUNE_DEFAULTS } from "../src/domains/hygiene/analytics-types";

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
