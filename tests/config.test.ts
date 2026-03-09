import { describe, it, expect, vi, beforeEach } from "vitest";
import * as vscode from "vscode";
import { Config } from "../src/infrastructure/config";
import { INFRASTRUCTURE_ERROR_CODES } from "../src/infrastructure/error-codes";
import { PRUNE_DEFAULTS } from "../src/domains/hygiene/analytics-types";

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(),
  },
}));

describe("Config", () => {
  let config: Config;

  beforeEach(() => {
    vi.resetAllMocks();
    config = new Config();
  });

  // =========================================================================
  // initialize()
  // =========================================================================
  describe("initialize()", () => {
    // -------------------------------------------------------------------------
    // 1. All keys set — store populated with VS Code values
    // -------------------------------------------------------------------------
    it("succeeds and populates store with values from VS Code config", async () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string) => {
          const values: Record<string, unknown> = {
            "git.autofetch": true,
            "git.branchClean": false,
            "hygiene.enabled": false,
            "hygiene.scanInterval": 30,
            "chat.model": "claude-3-sonnet",
            "chat.contextLines": 100,
            "log.level": "debug",
          };
          return values[key];
        }),
      } as any);

      const result = await config.initialize();

      expect(result.kind).toBe("ok");
      expect(config.get("git.autofetch")).toBe(true);
      expect(config.get("git.branchClean")).toBe(false);
      expect(config.get("chat.model")).toBe("claude-3-sonnet");
      expect(config.get("chat.contextLines")).toBe(100);
      expect(config.get("log.level")).toBe("debug");
    });

    // -------------------------------------------------------------------------
    // 2. All keys undefined — falls back to code-level DEFAULTS
    // -------------------------------------------------------------------------
    it("falls back to DEFAULTS for keys returning undefined", async () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn(() => undefined),
      } as any);

      const result = await config.initialize();

      expect(result.kind).toBe("ok");
      expect(config.get("git.autofetch")).toBe(false);
      expect(config.get("hygiene.scanInterval")).toBe(60);
      expect(config.get("chat.model")).toBe("gpt-4");
      expect(config.get("log.level")).toBe("info");
    });

    // -------------------------------------------------------------------------
    // 3. getConfiguration throws — returns typed failure
    // -------------------------------------------------------------------------
    it("returns failure with CONFIG_INIT_ERROR when getConfiguration throws", async () => {
      vi.mocked(vscode.workspace.getConfiguration).mockImplementation(() => {
        throw new Error("vscode config unavailable");
      });

      const result = await config.initialize();

      expect(result.kind).toBe("err");
      if (result.kind === "err") {
        expect(result.error.code).toBe(INFRASTRUCTURE_ERROR_CODES.CONFIG_INIT_ERROR);
      }
    });

    // -------------------------------------------------------------------------
    // 4. Failure path — store falls back to DEFAULTS so extension keeps working
    // -------------------------------------------------------------------------
    it("falls back to DEFAULTS in store when initialization fails", async () => {
      vi.mocked(vscode.workspace.getConfiguration).mockImplementation(() => {
        throw new Error("vscode config unavailable");
      });

      await config.initialize();

      expect(config.get("git.autofetch")).toBe(false);
      expect(config.get("hygiene.scanInterval")).toBe(60);
    });
  });

  // =========================================================================
  // get()
  // =========================================================================
  describe("get()", () => {
    beforeEach(async () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn(() => undefined),
      } as any);
      await config.initialize(); // seeds store with DEFAULTS
    });

    // -------------------------------------------------------------------------
    // 5. Key present in store — returns stored value
    // -------------------------------------------------------------------------
    it("returns stored value for a known key", () => {
      expect(config.get("chat.model")).toBe("gpt-4");
    });

    // -------------------------------------------------------------------------
    // 6. Key absent, no default — returns undefined
    // -------------------------------------------------------------------------
    it("returns undefined for an absent key with no default", () => {
      expect(config.get("nonexistent.key")).toBeUndefined();
    });

    // -------------------------------------------------------------------------
    // 7. Key absent, with default — returns the defaultValue
    // -------------------------------------------------------------------------
    it("returns the provided defaultValue for an absent key", () => {
      expect(config.get("nonexistent.key", "fallback")).toBe("fallback");
    });
  });

  // =========================================================================
  // set()
  // =========================================================================
  describe("set()", () => {
    // -------------------------------------------------------------------------
    // 8. Happy path — store updated, success returned
    // -------------------------------------------------------------------------
    it("updates store and returns success", async () => {
      const result = await config.set("chat.model", "claude-opus");

      expect(result.kind).toBe("ok");
      expect(config.get("chat.model")).toBe("claude-opus");
    });

    // -------------------------------------------------------------------------
    // 9. Frozen store — assignment throws, returns typed failure
    // -------------------------------------------------------------------------
    it("returns failure with CONFIG_SET_ERROR when store is frozen", async () => {
      (config as any).store = Object.freeze({});

      const result = await config.set("git.autofetch", true);

      expect(result.kind).toBe("err");
      if (result.kind === "err") {
        expect(result.error.code).toBe(INFRASTRUCTURE_ERROR_CODES.CONFIG_SET_ERROR);
      }
    });
  });

  // =========================================================================
  // getPruneConfig()
  // =========================================================================
  describe("getPruneConfig()", () => {
    // -------------------------------------------------------------------------
    // 10. All prune keys configured — returns exact values
    // -------------------------------------------------------------------------
    it("returns exact values when all prune keys are set", () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string, _defaultValue: unknown) => {
          const values: Record<string, unknown> = {
            minAgeDays: 14,
            maxSizeMB: 5,
            minLineCount: 100,
            categories: ["log"],
          };
          return values[key];
        }),
      } as any);

      const pruneConfig = config.getPruneConfig();

      expect(pruneConfig.minAgeDays).toBe(14);
      expect(pruneConfig.maxSizeMB).toBe(5);
      expect(pruneConfig.minLineCount).toBe(100);
      expect(pruneConfig.categories).toEqual(["log"]);
    });

    // -------------------------------------------------------------------------
    // 11. All prune keys undefined — returns PRUNE_DEFAULTS
    // -------------------------------------------------------------------------
    it("returns PRUNE_DEFAULTS when all prune keys are undefined", () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((_key: string, defaultValue: unknown) => defaultValue),
      } as any);

      const pruneConfig = config.getPruneConfig();

      expect(pruneConfig).toEqual(PRUNE_DEFAULTS);
    });

    // -------------------------------------------------------------------------
    // 12. Partial override — overridden key wins, rest use defaults
    // -------------------------------------------------------------------------
    it("merges partial overrides with defaults", () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn((key: string, defaultValue: unknown) => {
          if (key === "minAgeDays") return 60;
          return defaultValue;
        }),
      } as any);

      const pruneConfig = config.getPruneConfig();

      expect(pruneConfig.minAgeDays).toBe(60);
      expect(pruneConfig.maxSizeMB).toBe(PRUNE_DEFAULTS.maxSizeMB);
      expect(pruneConfig.minLineCount).toBe(PRUNE_DEFAULTS.minLineCount);
      expect(pruneConfig.categories).toEqual(PRUNE_DEFAULTS.categories);
    });
  });

  // =========================================================================
  // exportAll()
  // =========================================================================
  describe("exportAll()", () => {
    // -------------------------------------------------------------------------
    // 13. Returns shallow copy — mutations don't affect the internal store
    // -------------------------------------------------------------------------
    it("returns a shallow copy that does not mutate the internal store", async () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: vi.fn(() => undefined),
      } as any);
      await config.initialize();

      const exported = config.exportAll();
      (exported as any)["chat.model"] = "mutated";

      expect(config.get("chat.model")).toBe("gpt-4");
    });
  });
});
