import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const {
  writeFileMock,
  showInformationMessageMock,
  showErrorMessageMock,
  showQuickPickMock,
  showSaveDialogMock,
  workspaceState,
} = vi.hoisted(() => ({
  writeFileMock: vi.fn(async () => {}),
  showInformationMessageMock: vi.fn(() => Promise.resolve(undefined)),
  showErrorMessageMock: vi.fn(() => Promise.resolve(undefined)),
  showQuickPickMock: vi.fn(),
  showSaveDialogMock: vi.fn(),
  workspaceState: { root: undefined as string | undefined },
}));

vi.mock("vscode", () => ({
  commands: { executeCommand: vi.fn() },
  window: {
    showInformationMessage: showInformationMessageMock,
    showErrorMessage: showErrorMessageMock,
    showQuickPick: showQuickPickMock,
    showSaveDialog: showSaveDialogMock,
    createWebviewPanel: vi.fn(),
  },
  workspace: {
    get workspaceFolders() {
      return workspaceState.root
        ? [{ uri: { fsPath: workspaceState.root } }]
        : undefined;
    },
    fs: { writeFile: writeFileMock },
  },
  Uri: {
    file: (fsPath: string) => ({ fsPath }),
  },
  ViewColumn: { One: 1 },
}));

import * as vscode from "vscode";
import { AnalyticsWebviewProvider } from "../src/infrastructure/webview-provider";
import { flushLatestSnapshotWrites } from "../src/infrastructure/latest-snapshot";
import { LATEST_SNAPSHOT_FILES, MERIDIAN_DIR, MERIDIAN_LATEST_DIR } from "../src/constants";

function makeProvider(root: string): AnalyticsWebviewProvider {
  const provider = new AnalyticsWebviewProvider(
    { fsPath: root } as unknown as vscode.Uri,
    root,
    async () => ({} as any)
  );
  // Stand in for a generated report — reportToJson (base) serializes any object.
  (provider as any).lastReport = { summary: { totalCommits: 1 } };
  return provider;
}

describe("WebviewProvider report export", () => {
  beforeEach(() => {
    writeFileMock.mockReset().mockResolvedValue(undefined);
    showInformationMessageMock.mockReset().mockReturnValue(Promise.resolve(undefined));
    showErrorMessageMock.mockReset().mockReturnValue(Promise.resolve(undefined));
    showQuickPickMock.mockReset();
    showSaveDialogMock.mockReset();
    workspaceState.root = undefined;
  });

  it("exportFileName is NTFS-safe with millisecond precision", () => {
    const provider = makeProvider("/tmp/whatever");
    const name: string = (provider as any).exportFileName("csv");
    // No raw ':' or '.' except the extension separator.
    expect(name).toMatch(
      /^meridian-git-analytics-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}\.csv$/
    );
  });

  it("quick-save with no workspace folder errors and writes nothing", async () => {
    workspaceState.root = undefined;
    const provider = makeProvider("/tmp/no-root");

    await (provider as any).handleQuickSave("json");

    expect(showErrorMessageMock).toHaveBeenCalledTimes(1);
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("quick-save writes into .meridian/artifacts and drops a self-ignoring .gitignore", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-export-"));
    workspaceState.root = root;
    const provider = makeProvider(root);

    await (provider as any).handleQuickSave("json");

    const artifactsDir = path.join(root, ".meridian", "artifacts");
    const gitignore = path.join(artifactsDir, ".gitignore");
    expect(fs.existsSync(gitignore)).toBe(true);
    expect(fs.readFileSync(gitignore, "utf-8")).toBe("*\n");

    expect(writeFileMock).toHaveBeenCalledTimes(1);
    const target = writeFileMock.mock.calls[0][0] as { fsPath: string };
    expect(target.fsPath.startsWith(artifactsDir)).toBe(true);
    expect(target.fsPath).toMatch(/meridian-git-analytics-.*\.json$/);
    expect(showInformationMessageMock).toHaveBeenCalled();
  });

  it("quick-save does not clobber an existing .gitignore", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-export-"));
    workspaceState.root = root;
    const artifactsDir = path.join(root, ".meridian", "artifacts");
    fs.mkdirSync(artifactsDir, { recursive: true });
    fs.writeFileSync(path.join(artifactsDir, ".gitignore"), "# custom\n", "utf-8");

    const provider = makeProvider(root);
    await (provider as any).handleQuickSave("json");

    expect(fs.readFileSync(path.join(artifactsDir, ".gitignore"), "utf-8")).toBe("# custom\n");
  });

  it("save-as cancelled (dialog returns nothing) leaves no artifacts dir behind", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-export-"));
    workspaceState.root = root;
    showQuickPickMock.mockResolvedValue("JSON");
    showSaveDialogMock.mockResolvedValue(undefined);

    const provider = makeProvider(root);
    await (provider as any).handleSaveAs();

    expect(writeFileMock).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(root, ".meridian", "artifacts"))).toBe(false);
  });

  describe("ADR 020 latest-snapshot write", () => {
    it("updateReport writes .meridian/latest/git-analytics.v1.json when a workspace is open", async () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-latest-export-"));
      workspaceState.root = root;
      const provider = makeProvider(root);

      const report = { summary: { totalCommits: 7 } };
      (provider as any).updateReport(report);
      // The write is genuinely async (queued, off the render path) — flush
      // before asserting on disk state.
      await flushLatestSnapshotWrites();

      const target = path.join(root, MERIDIAN_DIR, MERIDIAN_LATEST_DIR, LATEST_SNAPSHOT_FILES.gitAnalytics);
      expect(fs.existsSync(target)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(target, "utf-8"));
      expect(parsed.kind).toBe("gitAnalytics");
      expect(parsed.report).toEqual(report);
    });

    it("updateReport with no workspace folder writes nothing and does not throw", async () => {
      workspaceState.root = undefined;
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-latest-nows-"));
      const provider = makeProvider(root);

      expect(() => (provider as any).updateReport({ summary: {} })).not.toThrow();
      await flushLatestSnapshotWrites();
      // Not just "no throw": nothing may be materialized under the provider root.
      expect(fs.existsSync(path.join(root, MERIDIAN_DIR, MERIDIAN_LATEST_DIR))).toBe(false);
    });
  });
});
