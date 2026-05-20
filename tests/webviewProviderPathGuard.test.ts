import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const { executeCommandMock, showErrorMessageMock, showInformationMessageMock } = vi.hoisted(() => ({
  executeCommandMock: vi.fn(),
  showErrorMessageMock: vi.fn(),
  showInformationMessageMock: vi.fn(),
}));

vi.mock("vscode", () => ({
  commands: {
    executeCommand: executeCommandMock,
  },
  window: {
    showErrorMessage: showErrorMessageMock,
    showInformationMessage: showInformationMessageMock,
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
    showInformationMessageMock.mockReset();
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

  it("blocks ignorePath message for paths outside workspace and does not write .meridian/.meridianignore", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-webview-ignore-root-"));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-webview-ignore-outside-"));
    const outsideFile = path.join(outside, "secret.txt");
    fs.writeFileSync(outsideFile, "secret");

    const invalidate = vi.fn();
    const refresh = vi.fn(async () => {
      throw new Error("unused");
    });

    const provider = new AnalyticsWebviewProvider(
      { fsPath: root } as unknown as vscode.Uri,
      root,
      refresh,
      invalidate
    );

    await (provider as any).handleMessage({
      type: "ignorePath",
      payload: { path: outsideFile, kind: "file" },
    });

    expect(invalidate).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(showErrorMessageMock).toHaveBeenCalled();
    expect(fs.existsSync(path.join(root, ".meridian", ".meridianignore"))).toBe(false);
  });

  it("ignorePath message inside workspace appends, invalidates cache, and refreshes report", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-webview-ignore-ok-"));
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "noisy.ts"), "export {};\n");

    const invalidate = vi.fn();
    const refresh = vi.fn(async () => {
      // Stand in for onFilter — return a minimal report shape.
      return {} as any;
    });

    const provider = new AnalyticsWebviewProvider(
      { fsPath: root } as unknown as vscode.Uri,
      root,
      refresh,
      invalidate
    );

    await (provider as any).handleMessage({
      type: "ignorePath",
      payload: { path: "src/noisy.ts", kind: "file" },
    });

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(showInformationMessageMock).toHaveBeenCalled();
    expect(fs.readFileSync(path.join(root, ".meridian", ".meridianignore"), "utf-8")).toBe(
      "src/noisy.ts\n"
    );
  });
});
