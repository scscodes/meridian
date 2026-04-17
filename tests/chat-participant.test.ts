/**
 * Chat Participant Routing Tests — covers the 3-tier routing precedence
 * documented in ui/chat-participant.ts, plus the free-text nudge.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CommandContext } from "../src/types";
import { success } from "../src/types";
import { MockLogger } from "./fixtures";

// ── Mock vscode before importing the module under test ────────────────────────
vi.mock("vscode", () => ({
  chat: {
    createChatParticipant: vi.fn(),
  },
  Uri: {
    joinPath: vi.fn().mockReturnValue({ fsPath: "/ext/media/icon.svg" }),
    file: vi.fn().mockReturnValue({ fsPath: "/ext" }),
  },
}));

import { createChatParticipant } from "../src/ui/chat-participant";
import * as vscode from "vscode";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRouter(dispatchResult = success({ branch: "main", isDirty: false, staged: 0, unstaged: 0, untracked: 0 })) {
  return { dispatch: vi.fn().mockResolvedValue(dispatchResult) };
}

function makeStream() {
  return { markdown: vi.fn(), progress: vi.fn() };
}

const BASE_CTX: CommandContext = {
  extensionPath: "/ext",
  workspaceFolders: ["/ws"],
  activeFilePath: "/ws/src/main.ts",
};

// ── Test Suite ────────────────────────────────────────────────────────────────

describe("ChatParticipant routing", () => {
  let router: ReturnType<typeof makeRouter>;
  let logger: MockLogger;
  let chatHandler: (req: Record<string, unknown>, chatCtx: unknown, stream: ReturnType<typeof makeStream>, token: unknown) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();
    router = makeRouter();
    logger = new MockLogger();

    vi.mocked(vscode.chat.createChatParticipant).mockImplementation((_id: string, handler: unknown) => {
      chatHandler = handler as typeof chatHandler;
      return { dispose: vi.fn(), iconPath: undefined } as unknown as ReturnType<typeof vscode.chat.createChatParticipant>;
    });

    createChatParticipant(router as any, BASE_CTX, logger);
  });

  // ── Tier 1: request.command ──────────────────────────────────────────────────

  it("tier 1: routes /status via request.command", async () => {
    const stream = makeStream();
    await chatHandler({ command: "status", prompt: "" }, {}, stream, {});
    expect(router.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ name: "git.status" }),
      BASE_CTX
    );
  });

  it("tier 1: routes /scan via request.command", async () => {
    const stream = makeStream();
    await chatHandler({ command: "scan", prompt: "" }, {}, stream, {});
    expect(router.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ name: "hygiene.scan" }),
      BASE_CTX
    );
  });

  it("tier 1: routes /impact via request.command with active file", async () => {
    const stream = makeStream();
    await chatHandler({ command: "impact", prompt: "" }, {}, stream, {});
    expect(router.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ name: "hygiene.impactAnalysis", params: expect.objectContaining({ filePath: "/ws/src/main.ts" }) }),
      BASE_CTX
    );
  });

  it("tier 1: /impact with no active file shows message instead of dispatching", async () => {
    const ctxNoFile: CommandContext = { extensionPath: "/ext", workspaceFolders: ["/ws"] };
    vi.clearAllMocks();
    vi.mocked(vscode.chat.createChatParticipant).mockImplementation((_id: string, handler: unknown) => {
      chatHandler = handler as typeof chatHandler;
      return { dispose: vi.fn(), iconPath: undefined } as unknown as ReturnType<typeof vscode.chat.createChatParticipant>;
    });
    createChatParticipant(router as any, ctxNoFile, logger);

    const stream = makeStream();
    await chatHandler({ command: "impact", prompt: "" }, {}, stream, {});
    expect(router.dispatch).not.toHaveBeenCalled();
    expect(stream.markdown).toHaveBeenCalledWith(expect.stringContaining("TypeScript file"));
  });

  it("tier 1: unknown slash command with non-empty prompt falls through to NL tier then nudge", async () => {
    // chat.delegate returns dispatched:false (no generateProseFn / fallback to context)
    router.dispatch.mockResolvedValue(success({ dispatched: false, commandName: "chat.context", result: null }));
    const stream = makeStream();
    await chatHandler({ command: "unknownCommand", prompt: "show git status" }, {}, stream, {});
    expect(router.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ name: "chat.delegate", params: { task: "show git status" } }),
      BASE_CTX
    );
    expect(stream.markdown).toHaveBeenCalledWith(expect.stringContaining("Copilot can use Meridian tools directly"));
  });

  // ── Tier 2: SLASH_MAP keyword in prompt ──────────────────────────────────────

  it("tier 2: routes /status keyword in prompt text", async () => {
    const stream = makeStream();
    await chatHandler({ command: undefined, prompt: "/status" }, {}, stream, {});
    expect(router.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ name: "git.status" }),
      BASE_CTX
    );
  });

  it("tier 2: routes /pr keyword in prompt text", async () => {
    const stream = makeStream();
    await chatHandler({ command: undefined, prompt: "/pr" }, {}, stream, {});
    expect(router.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ name: "git.generatePR" }),
      BASE_CTX
    );
  });

  // ── Tier 3: "run <name>" shorthand ───────────────────────────────────────────

  it("tier 3: routes 'run deploy' to workflow.run with correct name", async () => {
    const stream = makeStream();
    await chatHandler({ command: undefined, prompt: "run deploy" }, {}, stream, {});
    expect(router.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ name: "workflow.run", params: { name: "deploy" } }),
      BASE_CTX
    );
  });

  it("tier 3: routes 'run my-pipeline' to workflow.run", async () => {
    const stream = makeStream();
    await chatHandler({ command: undefined, prompt: "run my-pipeline" }, {}, stream, {});
    expect(router.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ name: "workflow.run", params: { name: "my-pipeline" } }),
      BASE_CTX
    );
  });

  // ── Tier 4: NL routing via chat.delegate ─────────────────────────────────────

  it("NL tier: routes free text to classified command and formats result", async () => {
    const statusValue = { branch: "main", isDirty: false, staged: 0, unstaged: 0, untracked: 0 };
    router.dispatch.mockResolvedValue(success({
      dispatched: true,
      commandName: "git.status",
      result: statusValue,
    }));
    const stream = makeStream();
    await chatHandler({ command: undefined, prompt: "show me my git status please" }, {}, stream, {});
    expect(router.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ name: "chat.delegate", params: { task: "show me my git status please" } }),
      BASE_CTX
    );
    const allMarkdown = stream.markdown.mock.calls.map((c: unknown[]) => c[0]).join("");
    expect(allMarkdown).toContain("git.status");
    expect(allMarkdown).toContain("main");
  });

  it("NL tier: routes free text to workflow.run and formats result", async () => {
    const stepResults = [{ stepId: "build", success: true }];
    router.dispatch.mockResolvedValue(success({
      dispatched: true,
      commandName: "workflow.run",
      result: { workflowName: "deploy", success: true, duration: 1200, stepCount: 1, message: "ok", stepResults },
    }));
    const stream = makeStream();
    await chatHandler({ command: undefined, prompt: "deploy my app" }, {}, stream, {});
    expect(router.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ name: "chat.delegate", params: { task: "deploy my app" } }),
      BASE_CTX
    );
    const allMarkdown = stream.markdown.mock.calls.map((c: unknown[]) => c[0]).join("");
    expect(allMarkdown).toContain("deploy");
    expect(allMarkdown).toContain("build");
  });

  it("NL tier: falls back to nudge when chat.delegate is unavailable (no generateProseFn)", async () => {
    router.dispatch.mockResolvedValue(success({ dispatched: false, commandName: "chat.context", result: null }));
    const stream = makeStream();
    await chatHandler({ command: undefined, prompt: "do something" }, {}, stream, {});
    expect(router.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ name: "chat.delegate" }),
      BASE_CTX
    );
    expect(stream.markdown).toHaveBeenCalledWith(expect.stringContaining("Available slash commands"));
  });

  it("NL tier: falls back to nudge when chat.delegate returns an error", async () => {
    router.dispatch.mockResolvedValue({ kind: "err", error: { code: "CHAT_DELEGATE_NO_GENERATE_FN", message: "no Copilot" } });
    const stream = makeStream();
    await chatHandler({ command: undefined, prompt: "show me something" }, {}, stream, {});
    expect(stream.markdown).toHaveBeenCalledWith(expect.stringContaining("Copilot can use Meridian tools directly"));
  });

  // ── Edge cases ───────────────────────────────────────────────────────────────

  it("empty prompt shows help message without dispatching", async () => {
    const stream = makeStream();
    await chatHandler({ command: undefined, prompt: "" }, {}, stream, {});
    expect(router.dispatch).not.toHaveBeenCalled();
    expect(stream.markdown).toHaveBeenCalledWith(expect.stringContaining("/status"));
  });

  it("whitespace-only prompt shows help message", async () => {
    const stream = makeStream();
    await chatHandler({ command: undefined, prompt: "   " }, {}, stream, {});
    expect(router.dispatch).not.toHaveBeenCalled();
  });

  // ── workflow.run tree integration ────────────────────────────────────────────

  it("tier 3: calls workflowTree.setRunning before dispatch for 'run <name>'", async () => {
    const workflowResult = success({
      workflowName: "deploy", success: true, duration: 1500, stepCount: 2,
      message: "ok", stepResults: [{ stepId: "build", success: true }],
    });
    router.dispatch.mockResolvedValue(workflowResult);

    const workflowTree = { setRunning: vi.fn(), setLastRun: vi.fn() };
    vi.clearAllMocks();
    vi.mocked(vscode.chat.createChatParticipant).mockImplementation((_id: string, handler: unknown) => {
      chatHandler = handler as typeof chatHandler;
      return { dispose: vi.fn(), iconPath: undefined } as unknown as ReturnType<typeof vscode.chat.createChatParticipant>;
    });
    createChatParticipant(router as any, BASE_CTX, logger, workflowTree as any);

    const stream = makeStream();
    await chatHandler({ command: undefined, prompt: "run deploy" }, {}, stream, {});

    expect(workflowTree.setRunning).toHaveBeenCalledWith("deploy");
  });

  it("tier 3: calls workflowTree.setLastRun with step results after 'run <name>' completes", async () => {
    const stepResults = [
      { stepId: "build", success: true },
      { stepId: "test", success: false, error: "timeout" },
    ];
    const workflowResult = success({
      workflowName: "deploy", success: false, duration: 3200, stepCount: 2,
      failedAt: "test", message: "failed", stepResults,
    });
    router.dispatch.mockResolvedValue(workflowResult);

    const workflowTree = { setRunning: vi.fn(), setLastRun: vi.fn() };
    vi.clearAllMocks();
    vi.mocked(vscode.chat.createChatParticipant).mockImplementation((_id: string, handler: unknown) => {
      chatHandler = handler as typeof chatHandler;
      return { dispose: vi.fn(), iconPath: undefined } as unknown as ReturnType<typeof vscode.chat.createChatParticipant>;
    });
    createChatParticipant(router as any, BASE_CTX, logger, workflowTree as any);

    const stream = makeStream();
    await chatHandler({ command: undefined, prompt: "run deploy" }, {}, stream, {});

    expect(workflowTree.setLastRun).toHaveBeenCalledWith("deploy", false, 3200, stepResults);
  });

  // ── workflow.run RESULT_FORMATTERS ───────────────────────────────────────────

  it("workflow.run formatter produces step-by-step markdown", async () => {
    const stepResults = [
      { stepId: "build", success: true },
      { stepId: "test", success: false, error: "timeout" },
    ];
    const workflowResult = success({
      workflowName: "ci-pipeline", success: false, duration: 4100, stepCount: 2,
      failedAt: "test", message: "failed", stepResults,
    });
    router.dispatch.mockResolvedValue(workflowResult);

    const stream = makeStream();
    await chatHandler({ command: undefined, prompt: "run ci-pipeline" }, {}, stream, {});

    const allMarkdown = stream.markdown.mock.calls.map((c: unknown[]) => c[0]).join("");
    expect(allMarkdown).toContain("ci-pipeline");
    expect(allMarkdown).toContain("build");
    expect(allMarkdown).toContain("test");
    expect(allMarkdown).toContain("timeout");
    // Success step uses ✓, failure uses ✗
    expect(allMarkdown).toMatch(/✓.*build|build.*✓/);
    expect(allMarkdown).toMatch(/✗.*test|test.*✗/);
  });
});
