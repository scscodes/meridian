import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const { executeCommandMock, showErrorMessageMock } = vi.hoisted(() => ({
  executeCommandMock: vi.fn(),
  showErrorMessageMock: vi.fn(),
}));

vi.mock("vscode", () => ({
  commands: {
    executeCommand: executeCommandMock,
  },
  window: {
    showErrorMessage: showErrorMessageMock,
    createWebviewPanel: vi.fn(),
  },
  Uri: {
    file: (fsPath: string) => ({ fsPath }),
    joinPath: (...parts: Array<{ fsPath?: string } | string>) => ({
      fsPath: parts.map((p) => (typeof p === "string" ? p : p.fsPath ?? "")).join("/"),
    }),
  },
  ViewColumn: { One: 1 },
}));

import * as vscode from "vscode";
import { AnalyticsWebviewProvider } from "../src/infrastructure/webview-provider";

describe("WebviewProvider path boundary enforcement", () => {
  beforeEach(() => {
    executeCommandMock.mockReset();
    showErrorMessageMock.mockReset();
  });

  it("blocks openFile message for paths outside workspace", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-webview-root-"));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-webview-outside-"));
    const outsideFile = path.join(outside, "secret.txt");
    fs.writeFileSync(outsideFile, "secret");

    const provider = new AnalyticsWebviewProvider(
      { fsPath: root } as unknown as vscode.Uri,
      root,
      async () => {
        throw new Error("unused");
      }
    );

    await (provider as any).onMessage({ type: "openFile", payload: outsideFile });

    expect(executeCommandMock).not.toHaveBeenCalled();
    expect(showErrorMessageMock).toHaveBeenCalled();
  });
});
