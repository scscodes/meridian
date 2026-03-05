import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import { readJsonFile, listJsonFiles } from "../src/infrastructure/workspace";

vi.mock("fs");

describe("workspace utilities", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // =========================================================================
  // readJsonFile
  // =========================================================================
  describe("readJsonFile", () => {
    // ---------------------------------------------------------------------
    // 1. Valid JSON — returns parsed object
    // ---------------------------------------------------------------------
    it("returns parsed object for valid JSON", () => {
      vi.mocked(fs.readFileSync).mockReturnValue('{"key": "value", "count": 42}');

      const result = readJsonFile<{ key: string; count: number }>("/path/to/file.json");

      expect(result).toEqual({ key: "value", count: 42 });
      expect(fs.readFileSync).toHaveBeenCalledWith("/path/to/file.json", "utf8");
    });

    // ---------------------------------------------------------------------
    // 2. Invalid JSON — returns null
    // ---------------------------------------------------------------------
    it("returns null for invalid JSON content", () => {
      vi.mocked(fs.readFileSync).mockReturnValue("not valid json {{{");

      const result = readJsonFile("/path/to/bad.json");

      expect(result).toBeNull();
    });

    // ---------------------------------------------------------------------
    // 3. Missing file (readFileSync throws) — returns null
    // ---------------------------------------------------------------------
    it("returns null when file does not exist", () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("ENOENT: no such file or directory");
      });

      const result = readJsonFile("/path/to/missing.json");

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // listJsonFiles
  // =========================================================================
  describe("listJsonFiles", () => {
    // ---------------------------------------------------------------------
    // 4. Mixed files — only .json files returned as full paths
    // ---------------------------------------------------------------------
    it("returns only .json files as full paths", () => {
      vi.mocked(fs.readdirSync).mockReturnValue([
        { name: "a.json", isFile: () => true } as any,
        { name: "b.txt", isFile: () => true } as any,
        { name: "c.json", isFile: () => true } as any,
        { name: "dir", isFile: () => false } as any,
      ]);

      const result = listJsonFiles("/workspace/.vscode/agents");

      expect(result).toEqual([
        "/workspace/.vscode/agents/a.json",
        "/workspace/.vscode/agents/c.json",
      ]);
      expect(fs.readdirSync).toHaveBeenCalledWith("/workspace/.vscode/agents", {
        withFileTypes: true,
      });
    });

    // ---------------------------------------------------------------------
    // 5. Missing directory (readdirSync throws) — returns empty array
    // ---------------------------------------------------------------------
    it("returns empty array when directory does not exist", () => {
      vi.mocked(fs.readdirSync).mockImplementation(() => {
        throw new Error("ENOENT: no such file or directory");
      });

      const result = listJsonFiles("/nonexistent/path");

      expect(result).toEqual([]);
    });
  });
});
