import { describe, expect, it } from "vitest";
import { resolveWorkspacePath } from "../src/security/path-guard";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("resolveWorkspacePath", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-path-guard-"));
  const insideFile = path.join(root, "src", "index.ts");
  fs.mkdirSync(path.dirname(insideFile), { recursive: true });
  fs.writeFileSync(insideFile, "export {};\n");

  it("resolves relative paths inside workspace", () => {
    expect(resolveWorkspacePath(root, "src/index.ts")).toBe(insideFile);
  });

  it("allows absolute paths inside workspace", () => {
    expect(resolveWorkspacePath(root, insideFile)).toBe(insideFile);
  });

  it("rejects traversal outside workspace", () => {
    const outside = path.join(root, "..", "outside.txt");
    fs.writeFileSync(outside, "nope");
    expect(() => resolveWorkspacePath(root, "../outside.txt")).toThrow("outside workspace");
  });

  it("rejects absolute paths outside workspace", () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-outside-"));
    const outsideFile = path.join(outside, "secrets.txt");
    fs.writeFileSync(outsideFile, "nope");
    expect(() => resolveWorkspacePath(root, outsideFile)).toThrow("outside workspace");
  });

  it("rejects symlink escapes outside workspace", () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-symlink-outside-"));
    const outsideFile = path.join(outside, "secret.txt");
    fs.writeFileSync(outsideFile, "secret");
    const linkPath = path.join(root, "linked-secret.txt");
    fs.symlinkSync(outsideFile, linkPath);

    expect(() => resolveWorkspacePath(root, "linked-secret.txt")).toThrow("outside workspace");
  });
});
