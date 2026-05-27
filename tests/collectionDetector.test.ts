import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { detectCollections } from "../src/domains/hygiene/collection-detector";

describe("detectCollections", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "collection-detector-"));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  const mkdir = (rel: string) => fs.mkdirSync(path.join(tmpRoot, rel), { recursive: true });

  it("returns empty arrays for an empty workspace", () => {
    expect(detectCollections(tmpRoot)).toEqual({
      envs: [],
      caches: [],
      buildOutputs: [],
      vendoredDeps: [],
    });
  });

  it("buckets .venv at root as envs", () => {
    mkdir(".venv");
    expect(detectCollections(tmpRoot).envs).toEqual([".venv"]);
  });

  it("buckets __pycache__ as caches", () => {
    mkdir("lib/__pycache__");
    expect(detectCollections(tmpRoot).caches).toEqual(["lib/__pycache__"]);
  });

  it("buckets dist at root as buildOutputs", () => {
    mkdir("dist");
    expect(detectCollections(tmpRoot).buildOutputs).toEqual(["dist"]);
  });

  it("buckets node_modules at root as vendoredDeps", () => {
    mkdir("node_modules");
    expect(detectCollections(tmpRoot).vendoredDeps).toEqual(["node_modules"]);
  });

  it("finds nested collection dirs up to MAX_DEPTH", () => {
    mkdir("server/.venv");
    mkdir("apps/client/dist");
    const result = detectCollections(tmpRoot);
    expect(result.envs).toEqual(["server/.venv"]);
    expect(result.buildOutputs).toEqual(["apps/client/dist"]);
  });

  it("does not recurse into matched collection dirs", () => {
    mkdir("node_modules/some-pkg/dist");
    const result = detectCollections(tmpRoot);
    expect(result.vendoredDeps).toEqual(["node_modules"]);
    expect(result.buildOutputs).toEqual([]);
  });

  it("skips .git and .meridian", () => {
    mkdir(".git/objects/abc");
    mkdir(".meridian/artifacts");
    fs.mkdirSync(path.join(tmpRoot, ".git", "build"), { recursive: true });
    const result = detectCollections(tmpRoot);
    expect(result.buildOutputs).toEqual([]);
  });

  it("sorts each bucket alphabetically", () => {
    mkdir("z/build");
    mkdir("a/build");
    mkdir("m/build");
    expect(detectCollections(tmpRoot).buildOutputs).toEqual([
      "a/build",
      "m/build",
      "z/build",
    ]);
  });

  it("captures multiple bucket types in one scan", () => {
    mkdir(".venv");
    mkdir("__pycache__");
    mkdir("dist");
    mkdir("node_modules");
    const result = detectCollections(tmpRoot);
    expect(result.envs).toEqual([".venv"]);
    expect(result.caches).toEqual(["__pycache__"]);
    expect(result.buildOutputs).toEqual(["dist"]);
    expect(result.vendoredDeps).toEqual(["node_modules"]);
  });

  it("returns empty arrays gracefully for a non-existent path", () => {
    expect(detectCollections(path.join(tmpRoot, "does-not-exist"))).toEqual({
      envs: [],
      caches: [],
      buildOutputs: [],
      vendoredDeps: [],
    });
  });
});
