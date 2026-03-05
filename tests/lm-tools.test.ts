/**
 * LM Tools Tests — verifies tool registration and invocation via router.dispatch().
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CommandContext } from "../src/types";
import { success, failure } from "../src/types";
import { MockLogger } from "./fixtures";

// ── Mock vscode before importing the module under test ────────────────────────
vi.mock("vscode", () => ({
  lm: {
    registerTool: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  },
  LanguageModelToolResult: vi.fn().mockImplementation((parts: unknown[]) => ({ parts })),
  LanguageModelTextPart: vi.fn().mockImplementation((text: string) => ({ value: text })),
}));

import { registerMeridianTools } from "../src/ui/lm-tools";
import * as vscode from "vscode";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRouter(result = success({ branch: "main", isDirty: false, staged: 0, unstaged: 0, untracked: 0 })) {
  return { dispatch: vi.fn().mockResolvedValue(result) };
}

const BASE_CTX: CommandContext = {
  extensionPath: "/ext",
  workspaceFolders: ["/ws"],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("registerMeridianTools", () => {
  let router: ReturnType<typeof makeRouter>;
  let logger: MockLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    router = makeRouter();
    logger = new MockLogger();
  });

  it("registers all tools via vscode.lm.registerTool", () => {
    registerMeridianTools(router as any, BASE_CTX, logger);
    expect(vscode.lm.registerTool).toHaveBeenCalledTimes(16);
  });

  it("returns one disposable per tool", () => {
    const disposables = registerMeridianTools(router as any, BASE_CTX, logger);
    expect(disposables).toHaveLength(16);
    expect(disposables[0]).toHaveProperty("dispose");
  });

  it("registers meridian_git_status tool", () => {
    registerMeridianTools(router as any, BASE_CTX, logger);
    expect(vscode.lm.registerTool).toHaveBeenCalledWith(
      "meridian_git_status",
      expect.objectContaining({ invoke: expect.any(Function) })
    );
  });

  it("registers meridian_hygiene_scan tool", () => {
    registerMeridianTools(router as any, BASE_CTX, logger);
    expect(vscode.lm.registerTool).toHaveBeenCalledWith(
      "meridian_hygiene_scan",
      expect.objectContaining({ invoke: expect.any(Function) })
    );
  });

  it("registers meridian_git_analyze_inbound tool", () => {
    registerMeridianTools(router as any, BASE_CTX, logger);
    expect(vscode.lm.registerTool).toHaveBeenCalledWith(
      "meridian_git_analyze_inbound",
      expect.objectContaining({ invoke: expect.any(Function) })
    );
  });
});

describe("LM tool invocation", () => {
  let router: ReturnType<typeof makeRouter>;
  let logger: MockLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new MockLogger();
  });

  /**
   * Get the invoke function for a registered tool by name.
   */
  function getToolInvoke(toolName: string): (options: Record<string, unknown>, token: unknown) => Promise<unknown> {
    const callArgs = vi.mocked(vscode.lm.registerTool).mock.calls;
    const call = callArgs.find(([name]) => name === toolName);
    if (!call) throw new Error(`Tool '${toolName}' not registered`);
    return (call[1] as { invoke: (opts: Record<string, unknown>, token: unknown) => Promise<unknown> }).invoke;
  }

  it("git.status tool dispatches git.status command and returns formatted text", async () => {
    const statusResult = success({ branch: "main", isDirty: false, staged: 0, unstaged: 0, untracked: 0 });
    router = makeRouter(statusResult);
    registerMeridianTools(router as any, BASE_CTX, logger);

    const invoke = getToolInvoke("meridian_git_status");
    const result = await invoke({ input: {} }, {}) as { parts: { value: string }[] };

    expect(router.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ name: "git.status" }),
      BASE_CTX
    );
    expect(result.parts[0].value).toContain("main");
  });

  it("hygiene.scan tool dispatches hygiene.scan command", async () => {
    const scanResult = success({ deadFiles: [], largeFiles: [], logFiles: [], markdownFiles: [], deadCode: { items: [], tsconfigPath: null, durationMs: 0, fileCount: 0 } });
    router = makeRouter(scanResult);
    registerMeridianTools(router as any, BASE_CTX, logger);

    const invoke = getToolInvoke("meridian_hygiene_scan");
    await invoke({ input: {} }, {});

    expect(router.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ name: "hygiene.scan" }),
      BASE_CTX
    );
  });

  it("passes input params through to router.dispatch", async () => {
    router = makeRouter();
    registerMeridianTools(router as any, BASE_CTX, logger);

    const invoke = getToolInvoke("meridian_workflow_run");
    await invoke({ input: { name: "deploy" } }, {});

    expect(router.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ name: "workflow.run", params: { name: "deploy" } }),
      BASE_CTX
    );
  });

  it("error result returns readable error text (not raw object)", async () => {
    const errResult = failure({ code: "GIT_UNAVAILABLE", message: "Git not found" });
    router = makeRouter(errResult);
    registerMeridianTools(router as any, BASE_CTX, logger);

    const invoke = getToolInvoke("meridian_git_status");
    const result = await invoke({ input: {} }, {}) as { parts: { value: string }[] };

    expect(result.parts[0].value).toContain("Git");
    expect(result.parts[0].value).not.toBe("[object Object]");
  });

  it("successful result returns LanguageModelToolResult", async () => {
    router = makeRouter(success({ branch: "main", isDirty: false, staged: 1, unstaged: 0, untracked: 0 }));
    registerMeridianTools(router as any, BASE_CTX, logger);

    const invoke = getToolInvoke("meridian_git_status");
    const result = await invoke({ input: {} }, {});

    expect(vscode.LanguageModelToolResult).toHaveBeenCalled();
    expect(vscode.LanguageModelTextPart).toHaveBeenCalled();
    expect(result).toHaveProperty("parts");
  });
});
