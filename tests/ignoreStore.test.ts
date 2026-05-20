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
  it("returns [] when .meridianignore is missing", () => {
    const root = makeWorkspace();
    expect(readMeridianIgnorePatterns(root)).toEqual([]);
  });

  it("skips blanks and comments, wraps bare patterns with **/", () => {
    const root = makeWorkspace();
    fs.writeFileSync(
      path.join(root, ".meridianignore"),
      "# header\n\nsrc/index.ts\nbuild/\n**/already-prefixed\n"
    );
    expect(readMeridianIgnorePatterns(root)).toEqual([
      "**/src/index.ts",
      "**/build",
      "**/already-prefixed",
    ]);
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
    expect(fs.readFileSync(path.join(root, ".meridianignore"), "utf-8")).toBe(
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
    expect(fs.readFileSync(path.join(root, ".meridianignore"), "utf-8")).toBe(
      "src/domains\n"
    );
  });

  it("preserves existing content and adds a separator newline when needed", () => {
    const root = makeWorkspace();
    fs.writeFileSync(path.join(root, ".meridianignore"), "build");
    const result = appendIgnorePattern(root, "src/index.ts", "file");
    expect(result.kind).toBe("ok");
    expect(fs.readFileSync(path.join(root, ".meridianignore"), "utf-8")).toBe(
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
    expect(fs.readFileSync(path.join(root, ".meridianignore"), "utf-8")).toBe(
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
    expect(fs.existsSync(path.join(root, ".meridianignore"))).toBe(false);
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
});
