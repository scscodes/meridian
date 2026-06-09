import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { readSetting, SETTING_DEFAULTS } from "../src/infrastructure/settings";

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: vi.fn(),
    workspaceFolders: undefined as undefined | ReadonlyArray<{ uri: { fsPath: string } }>,
  },
}));

function setWorkspaceRoot(root: string | undefined): void {
  (vscode.workspace as unknown as {
    workspaceFolders?: ReadonlyArray<{ uri: { fsPath: string } }>;
  }).workspaceFolders = root === undefined ? undefined : [{ uri: { fsPath: root } }];
}

function makeWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "meridian-settings-"));
}

type MockedCfg = ReturnType<typeof vscode.workspace.getConfiguration>;

function mockCfg(get: (key: string, fallback: unknown) => unknown): MockedCfg {
  return { get: vi.fn(get) } as unknown as MockedCfg;
}

describe("readSetting()", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setWorkspaceRoot(undefined);
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

  describe(".meridian/settings.json workspace overrides", () => {
    it("overrides VS Code value when key is present in workspace settings", () => {
      const root = makeWorkspace();
      fs.mkdirSync(path.join(root, ".meridian"));
      fs.writeFileSync(
        path.join(root, ".meridian", "settings.json"),
        JSON.stringify({ "hygiene.prune.minAgeDays": 7 })
      );
      setWorkspaceRoot(root);
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
        mockCfg((_key, _fallback) => 30)
      );

      expect(readSetting("hygiene.prune.minAgeDays")).toBe(7);
    });

    it("falls through to VS Code config when key is absent from workspace settings", () => {
      const root = makeWorkspace();
      fs.mkdirSync(path.join(root, ".meridian"));
      fs.writeFileSync(
        path.join(root, ".meridian", "settings.json"),
        JSON.stringify({ "hygiene.prune.minAgeDays": 7 })
      );
      setWorkspaceRoot(root);
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
        mockCfg((_key, _fallback) => "claude-3-sonnet")
      );

      expect(readSetting("model.default")).toBe("claude-3-sonnet");
    });

    it("falls through to VS Code config when workspace settings JSON is malformed", () => {
      const root = makeWorkspace();
      fs.mkdirSync(path.join(root, ".meridian"));
      fs.writeFileSync(
        path.join(root, ".meridian", "settings.json"),
        "{ not valid json"
      );
      setWorkspaceRoot(root);
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
        mockCfg((_key, _fallback) => 30)
      );

      expect(readSetting("hygiene.prune.minAgeDays")).toBe(30);
    });

    it("falls through to VS Code config when workspace settings file is missing", () => {
      const root = makeWorkspace();
      setWorkspaceRoot(root);
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
        mockCfg((_key, _fallback) => 30)
      );

      expect(readSetting("hygiene.prune.minAgeDays")).toBe(30);
    });

    it("falls through when workspace settings JSON is an array (not an object)", () => {
      const root = makeWorkspace();
      fs.mkdirSync(path.join(root, ".meridian"));
      fs.writeFileSync(
        path.join(root, ".meridian", "settings.json"),
        JSON.stringify(["nope"])
      );
      setWorkspaceRoot(root);
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
        mockCfg((_key, _fallback) => true)
      );

      expect(readSetting("startup.enableFileWatchers")).toBe(true);
    });

    it("falls through when an overlay value is JSON null", () => {
      const root = makeWorkspace();
      fs.mkdirSync(path.join(root, ".meridian"));
      fs.writeFileSync(
        path.join(root, ".meridian", "settings.json"),
        JSON.stringify({ "hygiene.prune.minAgeDays": null })
      );
      setWorkspaceRoot(root);
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
        mockCfg((_key, _fallback) => 30)
      );

      expect(readSetting("hygiene.prune.minAgeDays")).toBe(30);
    });

    it("falls through when an overlay value has the wrong primitive type", () => {
      const root = makeWorkspace();
      fs.mkdirSync(path.join(root, ".meridian"));
      fs.writeFileSync(
        path.join(root, ".meridian", "settings.json"),
        JSON.stringify({ "startup.enableFileWatchers": "true" })
      );
      setWorkspaceRoot(root);
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
        mockCfg((_key, _fallback) => true)
      );

      expect(readSetting("startup.enableFileWatchers")).toBe(true);
    });

    it("falls through when an array-typed key receives a non-array overlay", () => {
      const root = makeWorkspace();
      fs.mkdirSync(path.join(root, ".meridian"));
      fs.writeFileSync(
        path.join(root, ".meridian", "settings.json"),
        JSON.stringify({ "security.gitNetwork.allowedHosts": "github.com" })
      );
      setWorkspaceRoot(root);
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
        mockCfg((_key, fallback) => fallback)
      );

      expect(readSetting("security.gitNetwork.allowedHosts")).toEqual([]);
    });

    it("falls through when an array-typed key receives an array with non-string elements", () => {
      const root = makeWorkspace();
      fs.mkdirSync(path.join(root, ".meridian"));
      fs.writeFileSync(
        path.join(root, ".meridian", "settings.json"),
        JSON.stringify({ "security.gitNetwork.allowedHosts": ["github.com", 42] })
      );
      setWorkspaceRoot(root);
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
        mockCfg((_key, fallback) => fallback)
      );

      expect(readSetting("security.gitNetwork.allowedHosts")).toEqual([]);
    });

    it("accepts a well-typed string[] overlay", () => {
      const root = makeWorkspace();
      fs.mkdirSync(path.join(root, ".meridian"));
      fs.writeFileSync(
        path.join(root, ".meridian", "settings.json"),
        JSON.stringify({ "security.gitNetwork.allowedHosts": ["github.com", "gitlab.com"] })
      );
      setWorkspaceRoot(root);
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(
        mockCfg((_key, fallback) => fallback)
      );

      expect(readSetting("security.gitNetwork.allowedHosts")).toEqual([
        "github.com",
        "gitlab.com",
      ]);
    });
  });
});
