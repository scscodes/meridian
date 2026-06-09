import { describe, it, expect, vi, beforeEach } from "vitest";
import * as vscode from "vscode";
import { getPruneConfig } from "../src/domains/hygiene/prune-config";
import { PRUNE_DEFAULTS } from "../src/domains/hygiene/analytics-types";

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(),
  },
}));

type MockedCfg = ReturnType<typeof vscode.workspace.getConfiguration>;

describe("getPruneConfig()", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns exact values when all prune keys are set", () => {
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string, _fallback: unknown) => {
        const values: Record<string, unknown> = {
          "hygiene.prune.minAgeDays": 14,
          "hygiene.prune.maxSizeMB": 5,
          "hygiene.prune.minLineCount": 100,
          "hygiene.prune.categories": ["log"],
        };
        return values[key];
      }),
    } as unknown as MockedCfg);

    const cfg = getPruneConfig();
    expect(cfg.minAgeDays).toBe(14);
    expect(cfg.maxSizeMB).toBe(5);
    expect(cfg.minLineCount).toBe(100);
    expect(cfg.categories).toEqual(["log"]);
  });

  it("returns PRUNE_DEFAULTS when all prune keys are undefined", () => {
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((_key: string, fallback: unknown) => fallback),
    } as unknown as MockedCfg);

    expect(getPruneConfig()).toEqual(PRUNE_DEFAULTS);
  });

  it("merges partial overrides with defaults", () => {
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn((key: string, fallback: unknown) => {
        if (key === "hygiene.prune.minAgeDays") return 60;
        return fallback;
      }),
    } as unknown as MockedCfg);

    const cfg = getPruneConfig();
    expect(cfg.minAgeDays).toBe(60);
    expect(cfg.maxSizeMB).toBe(PRUNE_DEFAULTS.maxSizeMB);
    expect(cfg.minLineCount).toBe(PRUNE_DEFAULTS.minLineCount);
    expect(cfg.categories).toEqual(PRUNE_DEFAULTS.categories);
  });
});
