import { describe, it, expect, vi, beforeEach } from "vitest";
import * as vscode from "vscode";
import { readSetting, SETTING_DEFAULTS } from "../src/infrastructure/settings";

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(),
  },
}));

type MockedCfg = ReturnType<typeof vscode.workspace.getConfiguration>;

function mockCfg(get: (key: string, fallback: unknown) => unknown): MockedCfg {
  return { get: vi.fn(get) } as unknown as MockedCfg;
}

describe("readSetting()", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns the VS Code-provided value when present", () => {
    const getSpy = vi.fn((_key: string, _fallback: unknown) => "claude-3-sonnet");
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
      { get: getSpy } as unknown as MockedCfg
    );

    expect(readSetting("model.default")).toBe("claude-3-sonnet");
    expect(getSpy).toHaveBeenCalledWith("model.default", SETTING_DEFAULTS["model.default"]);
  });

  it("returns the typed default when VS Code returns the fallback", () => {
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
      mockCfg((_key, fallback) => fallback)
    );

    expect(readSetting("model.default")).toBe(SETTING_DEFAULTS["model.default"]);
    expect(readSetting("security.lmEgress.mode")).toBe("prompt");
    expect(readSetting("startup.enableFileWatchers")).toBe(true);
  });

  it("returns the typed default when getConfiguration throws (test-mock shim)", () => {
    vi.mocked(vscode.workspace.getConfiguration).mockImplementation(() => {
      throw new Error("vscode workspace unavailable");
    });

    expect(readSetting("security.gitNetwork.mode")).toBe("prompt");
    expect(readSetting("security.clipboard.autoCopy")).toBe(false);
  });

  it("returns the typed default when getConfiguration returns undefined", () => {
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
      undefined as unknown as MockedCfg
    );

    expect(readSetting("startup.enableFileWatchers")).toBe(true);
    expect(readSetting("security.gitNetwork.allowedHosts")).toEqual([]);
  });
});
