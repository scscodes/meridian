import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import { listJsonFiles } from "../src/infrastructure/workspace";

vi.mock("fs");

describe("workspace utilities", () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
