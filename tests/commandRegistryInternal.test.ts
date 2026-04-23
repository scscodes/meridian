import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerCommands } from "../src/presentation/command-registry";

const { registerCommandMock } = vi.hoisted(() => ({
  registerCommandMock: vi.fn(),
}));

vi.mock("vscode", () => ({
  commands: {
    registerCommand: registerCommandMock,
  },
}));

describe("command registry internal command surface", () => {
  beforeEach(() => {
    registerCommandMock.mockReset();
  });

  it("does not register internal LM-tool-only command IDs as VS Code commands", () => {
    registerCommands(
      { subscriptions: [] } as any,
      { dispatch: vi.fn() } as any,
      { appendLine: vi.fn(), show: vi.fn() } as any,
      () => ({ extensionPath: "", workspaceFolders: [] } as any),
      () => ({ minAgeDays: 30, maxSizeMB: 1, minLineCount: 0, categories: [] } as any),
      {
        outputChannel: { appendLine: vi.fn(), show: vi.fn() } as any,
        analyticsPanel: {} as any,
        hygieneAnalyticsPanel: {} as any,
        sessionBriefingPanel: {} as any,
      }
    );

    const ids = registerCommandMock.mock.calls.map((c) => c[0]);
    expect(ids).not.toContain("meridian.chat.delegate");
    expect(ids).not.toContain("meridian.agent.execute");
    expect(ids).not.toContain("meridian.git.analyzeInbound");
  });
});
