import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { pathMatchesAny } from "../src/infrastructure/glob-match";
import {
  readGitignorePatterns,
  readMeridianIgnorePatterns,
} from "../src/security/ignore-store";

function makeWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "meridian-exclude-"));
}

describe("pathMatchesAny", () => {
  it("includes dotfiles under a baseline dir glob", () => {
    expect(pathMatchesAny("node_modules/.package-lock.json", ["**/node_modules/**"])).toBe(true);
    expect(pathMatchesAny(".vscode/settings.json", ["**/.vscode/**"])).toBe(true);
  });

  it("matches non-dot paths the same as before", () => {
    expect(pathMatchesAny("node_modules/foo/index.js", ["**/node_modules/**"])).toBe(true);
    expect(pathMatchesAny("src/visible.ts", ["**/node_modules/**"])).toBe(false);
  });

  it("returns false on an empty pattern array", () => {
    expect(pathMatchesAny("anything.js", [])).toBe(false);
  });

  it("accepts a single pattern string", () => {
    expect(pathMatchesAny("src/index.ts", "**/src/**")).toBe(true);
  });
});

describe("ignore-store + pathMatchesAny — end-to-end", () => {
  it("bare dir entry covers its contents (incl. dotfiles)", () => {
    const root = makeWorkspace();
    fs.mkdirSync(path.join(root, ".meridian"), { recursive: true });
    fs.writeFileSync(path.join(root, ".meridian", ".meridianignore"), "node_modules\n");

    const patterns = readMeridianIgnorePatterns(root);

    expect(pathMatchesAny("node_modules/foo.js", patterns)).toBe(true);
    expect(pathMatchesAny("node_modules/.package-lock.json", patterns)).toBe(true);
    expect(pathMatchesAny("node_modules", patterns)).toBe(true);
    expect(pathMatchesAny("src/index.ts", patterns)).toBe(false);
  });

  it("trailing-slash dir entry behaves identically to bare", () => {
    const root = makeWorkspace();
    fs.mkdirSync(path.join(root, ".meridian"), { recursive: true });
    fs.writeFileSync(path.join(root, ".meridian", ".meridianignore"), "build/\n");

    const patterns = readMeridianIgnorePatterns(root);

    expect(pathMatchesAny("build/out.js", patterns)).toBe(true);
    expect(pathMatchesAny("build", patterns)).toBe(true);
  });

  it("root-anchored /foo matches at root but not at depth", () => {
    const root = makeWorkspace();
    fs.mkdirSync(path.join(root, ".meridian"), { recursive: true });
    fs.writeFileSync(path.join(root, ".meridian", ".meridianignore"), "/dist\n");

    const patterns = readMeridianIgnorePatterns(root);

    expect(pathMatchesAny("dist/bundle.js", patterns)).toBe(true);
    expect(pathMatchesAny("dist", patterns)).toBe(true);
    expect(pathMatchesAny("packages/foo/dist/x.js", patterns)).toBe(false);
  });

  it(".gitignore reader benefits from the same expansion", () => {
    const root = makeWorkspace();
    fs.writeFileSync(path.join(root, ".gitignore"), "node_modules\ncoverage/\n");

    const patterns = readGitignorePatterns(root);

    expect(pathMatchesAny("node_modules/foo.js", patterns)).toBe(true);
    expect(pathMatchesAny("node_modules/.package-lock.json", patterns)).toBe(true);
    expect(pathMatchesAny("coverage/lcov.info", patterns)).toBe(true);
  });
});
