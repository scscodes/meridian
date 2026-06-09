/**
 * Dead Code Analyzer tests — uses real temp-dir fixtures and the TS compiler.
 * Each test writes TypeScript source files to a mkdtemp directory, runs the
 * analyzer, and verifies the resulting DeadCodeScan.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { DeadCodeAnalyzer } from "../src/domains/hygiene/dead-code-analyzer";
import { MockLogger } from "./fixtures";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeTsFile(dir: string, name: string, content: string): string {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

function writeTsconfig(dir: string): void {
  const tsconfig = {
    compilerOptions: {
      target: "ES2020",
      module: "CommonJS",
      strict: false,
    },
    include: ["./*.ts"],
  };
  fs.writeFileSync(path.join(dir, "tsconfig.json"), JSON.stringify(tsconfig), "utf-8");
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("DeadCodeAnalyzer", () => {
  let tmpDir: string;
  let logger: MockLogger;
  let analyzer: DeadCodeAnalyzer;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-dead-code-"));
    logger = new MockLogger();
    analyzer = new DeadCodeAnalyzer(logger);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------

  it("returns empty scan for a clean file (no unused)", () => {
    writeTsconfig(tmpDir);
    writeTsFile(tmpDir, "clean.ts", `
export function sum(a: number, b: number): number {
  return a + b;
}
`);

    const scan = analyzer.analyze(tmpDir);
    expect(scan.items).toHaveLength(0);
    expect(scan.tsconfigPath).not.toBeNull();
    expect(scan.fileCount).toBeGreaterThanOrEqual(1);
  });

  it("detects unused local variable (code 6133)", () => {
    writeTsconfig(tmpDir);
    writeTsFile(tmpDir, "unused-local.ts", `
export function example(): void {
  const unusedVar = 42;
  console.log("hello");
}
`);

    const scan = analyzer.analyze(tmpDir);
    const item = scan.items.find((i) => i.code === 6133);
    expect(item).toBeDefined();
    expect(item!.category).toBe("unusedLocal");
    expect(item!.message).toMatch(/unusedVar/);
    expect(item!.line).toBeGreaterThan(0);
    expect(item!.character).toBeGreaterThan(0);
  });

  it("detects unused function parameter (code 6133)", () => {
    writeTsconfig(tmpDir);
    writeTsFile(tmpDir, "unused-param.ts", `
export function greet(name: string): void {
  console.log("hi");
}
`);

    const scan = analyzer.analyze(tmpDir);
    const item = scan.items.find((i) => i.code === 6133 && i.message.includes("name"));
    expect(item).toBeDefined();
    expect(item!.category).toBe("unusedLocal");
  });

  it("detects all-imports-unused (code 6192)", () => {
    writeTsconfig(tmpDir);
    writeTsFile(tmpDir, "unused-import.ts", `
import { readFileSync, writeFileSync } from "fs";

export function doNothing(): void {}
`);

    const scan = analyzer.analyze(tmpDir);
    const item = scan.items.find((i) => i.code === 6192);
    expect(item).toBeDefined();
    expect(item!.category).toBe("unusedImport");
    expect(item!.filePath).toContain("unused-import.ts");
  });

  it("detects individual unused import binding (code 6133)", () => {
    writeTsconfig(tmpDir);
    // existsSync is unused; statSync IS used
    writeTsFile(tmpDir, "partial-import.ts", `
import { existsSync, statSync } from "fs";

export function check(p: string): boolean {
  return statSync(p).isFile();
}
`);

    const scan = analyzer.analyze(tmpDir);
    const item = scan.items.find(
      (i) => i.code === 6133 && i.message.includes("existsSync")
    );
    expect(item).toBeDefined();
    expect(item!.filePath).toContain("partial-import.ts");
    expect(item!.line).toBeGreaterThan(0);
  });

  it("reports correct 1-based line and character positions", () => {
    writeTsconfig(tmpDir);
    // unusedVar is on line 3 (1-based), starting at a known column
    writeTsFile(tmpDir, "position-check.ts", `
export function f(): void {
  const unusedVar = 1;
}
`);

    const scan = analyzer.analyze(tmpDir);
    const item = scan.items.find((i) => i.message.includes("unusedVar"));
    expect(item).toBeDefined();
    expect(item!.line).toBe(3); // 3rd line (1-based)
    expect(item!.character).toBeGreaterThan(0);
  });

  it("falls back gracefully when no tsconfig.json exists", () => {
    // Do NOT write tsconfig.json — tests run in /tmp so no parent tsconfig
    writeTsFile(tmpDir, "no-tsconfig.ts", `
export function x(): void {
  const orphan = 99;
  console.log("hi");
}
`);

    const scan = analyzer.analyze(tmpDir);
    // tsconfigPath should be null (or point to a system-level one outside tmpDir)
    if (scan.tsconfigPath !== null) {
      expect(scan.tsconfigPath).not.toContain(tmpDir);
    }
    // Should still detect the unused var
    const item = scan.items.find((i) => i.message.includes("orphan"));
    expect(item).toBeDefined();
  });

  it("sets tsconfigPath when tsconfig.json is present", () => {
    writeTsconfig(tmpDir);
    writeTsFile(tmpDir, "with-tsconfig.ts", `export function ok(): void {}`);

    const scan = analyzer.analyze(tmpDir);
    expect(scan.tsconfigPath).toContain("tsconfig.json");
  });

  it("returns cached result on second call (same object reference)", () => {
    writeTsconfig(tmpDir);
    writeTsFile(tmpDir, "cache-test.ts", `export function ok(): void {}`);

    const first = analyzer.analyze(tmpDir);
    const second = analyzer.analyze(tmpDir);
    expect(second).toBe(first);
  });

  it("clears cache and re-scans after clearCache()", () => {
    writeTsconfig(tmpDir);
    writeTsFile(tmpDir, "cache-clear.ts", `export function ok(): void {}`);

    const first = analyzer.analyze(tmpDir);
    analyzer.clearCache();
    const second = analyzer.analyze(tmpDir);
    // Different object reference after cache clear
    expect(second).not.toBe(first);
    // But same logical content
    expect(second.fileCount).toBe(first.fileCount);
  });

  it("includes durationMs and fileCount in returned scan", () => {
    writeTsconfig(tmpDir);
    writeTsFile(tmpDir, "meta.ts", `export const x = 1;`);

    const scan = analyzer.analyze(tmpDir);
    expect(scan.durationMs).toBeGreaterThanOrEqual(0);
    expect(scan.fileCount).toBeGreaterThanOrEqual(1);
  });

  it("returns empty scan on error (never throws)", () => {
    // Pass a non-existent directory — should not throw
    const scan = analyzer.analyze("/tmp/this-does-not-exist-meridian-test");
    expect(scan.items).toHaveLength(0);
    expect(scan.tsconfigPath).toBeNull();
    expect(scan.durationMs).toBeGreaterThanOrEqual(0);
  });
});
