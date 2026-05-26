import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  appendIgnorePattern,
  ignoreFileMtimeMs,
  readMeridianIgnorePatterns,
} from "../src/security/ignore-store";

function makeWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-ignore-store-"));
  fs.mkdirSync(path.join(root, "src", "domains"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "index.ts"), "export {};\n");
  fs.writeFileSync(path.join(root, "src", "domains", "noisy.ts"), "export {};\n");
  return root;
}

describe("readMeridianIgnorePatterns", () => {
  it("returns [] when .meridian/.meridianignore is missing", () => {
    const root = makeWorkspace();
    expect(readMeridianIgnorePatterns(root)).toEqual([]);
  });

  it("skips blanks/comments and expands every entry to cover children", () => {
    const root = makeWorkspace();
    fs.mkdirSync(path.join(root, ".meridian"), { recursive: true });
    fs.writeFileSync(
      path.join(root, ".meridian", ".meridianignore"),
      "# header\n\nsrc/index.ts\nbuild/\n**/already-prefixed\n"
    );
    const patterns = readMeridianIgnorePatterns(root);
    expect(patterns).toHaveLength(6);
    expect(patterns).toEqual(expect.arrayContaining([
      "**/src/index.ts", "**/src/index.ts/**",
      "**/build", "**/build/**",
      "**/already-prefixed", "**/already-prefixed/**",
    ]));
  });

  it("drops negation lines (!foo) — unsupported per ADR 015", () => {
    const root = makeWorkspace();
    fs.mkdirSync(path.join(root, ".meridian"), { recursive: true });
    fs.writeFileSync(
      path.join(root, ".meridian", ".meridianignore"),
      "node_modules\n!keep-me.ts\n!src/important.ts\n"
    );
    const patterns = readMeridianIgnorePatterns(root);
    expect(patterns.some((p) => p.includes("!"))).toBe(false);
    expect(patterns.some((p) => p.includes("keep-me"))).toBe(false);
    expect(patterns).toEqual(expect.arrayContaining([
      "**/node_modules", "**/node_modules/**",
    ]));
  });

  it("anchors `/foo` to workspace root (no **/ prefix)", () => {
    const root = makeWorkspace();
    fs.mkdirSync(path.join(root, ".meridian"), { recursive: true });
    fs.writeFileSync(
      path.join(root, ".meridian", ".meridianignore"),
      "/dist\n/coverage/\n"
    );
    expect(readMeridianIgnorePatterns(root)).toEqual(expect.arrayContaining([
      "dist", "dist/**",
      "coverage", "coverage/**",
    ]));
  });
});

describe("appendIgnorePattern", () => {
  it("appends a file pattern with no trailing newline", () => {
    const root = makeWorkspace();
    const result = appendIgnorePattern(root, "src/index.ts", "file");
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.value.pattern).toBe("src/index.ts");
      expect(result.value.alreadyExists).toBe(false);
    }
    expect(fs.readFileSync(path.join(root, ".meridian", ".meridianignore"), "utf-8")).toBe(
      "src/index.ts\n"
    );
  });

  it("appends a folder pattern using the file's parent directory", () => {
    const root = makeWorkspace();
    const result = appendIgnorePattern(root, "src/domains/noisy.ts", "folder");
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.value.pattern).toBe("src/domains");
    }
    expect(fs.readFileSync(path.join(root, ".meridian", ".meridianignore"), "utf-8")).toBe(
      "src/domains\n"
    );
  });

  it("preserves existing content and adds a separator newline when needed", () => {
    const root = makeWorkspace();
    fs.mkdirSync(path.join(root, ".meridian"), { recursive: true });
    fs.writeFileSync(path.join(root, ".meridian", ".meridianignore"), "build");
    const result = appendIgnorePattern(root, "src/index.ts", "file");
    expect(result.kind).toBe("ok");
    expect(fs.readFileSync(path.join(root, ".meridian", ".meridianignore"), "utf-8")).toBe(
      "build\nsrc/index.ts\n"
    );
  });

  it("dedupes — second add of the same pattern is a no-op", () => {
    const root = makeWorkspace();
    appendIgnorePattern(root, "src/index.ts", "file");
    const second = appendIgnorePattern(root, "src/index.ts", "file");
    expect(second.kind).toBe("ok");
    if (second.kind === "ok") {
      expect(second.value.alreadyExists).toBe(true);
    }
    expect(fs.readFileSync(path.join(root, ".meridian", ".meridianignore"), "utf-8")).toBe(
      "src/index.ts\n"
    );
  });

  it("rejects traversal outside the workspace", () => {
    const root = makeWorkspace();
    const outside = path.join(root, "..", "evil.txt");
    fs.writeFileSync(outside, "x");
    const result = appendIgnorePattern(root, "../evil.txt", "file");
    expect(result.kind).toBe("err");
    if (result.kind === "err") {
      expect(result.error.code).toBe("PATH_GUARD_BLOCKED");
    }
    expect(fs.existsSync(path.join(root, ".meridian", ".meridianignore"))).toBe(false);
  });

  it("refuses to ignore the workspace root when kind=folder", () => {
    const root = makeWorkspace();
    fs.writeFileSync(path.join(root, "top.txt"), "x");
    const result = appendIgnorePattern(root, "top.txt", "folder");
    expect(result.kind).toBe("err");
    if (result.kind === "err") {
      expect(result.error.code).toBe("INVALID_IGNORE_PATTERN");
    }
  });

  it("ignoreFileMtimeMs changes after a successful append", () => {
    const root = makeWorkspace();
    expect(ignoreFileMtimeMs(root)).toBe(0);
    appendIgnorePattern(root, "src/index.ts", "file");
    expect(ignoreFileMtimeMs(root)).toBeGreaterThan(0);
  });

  it("creates .meridian/ on first append when the dotdir is missing", () => {
    const root = makeWorkspace();
    expect(fs.existsSync(path.join(root, ".meridian"))).toBe(false);
    const result = appendIgnorePattern(root, "src/index.ts", "file");
    expect(result.kind).toBe("ok");
    expect(fs.existsSync(path.join(root, ".meridian"))).toBe(true);
    expect(fs.readFileSync(path.join(root, ".meridian", ".meridianignore"), "utf-8")).toBe(
      "src/index.ts\n"
    );
  });
});
