import { describe, it, expect, vi } from "vitest";
import { createDelegateHandler, GenerateProseFn } from "../src/domains/chat/handlers";
import { MockLogger, assertSuccess, assertFailure } from "./fixtures";
import { success, failure } from "../src/types";
import type { Command, CommandContext, Result } from "../src/types";

const mockCtx: CommandContext = {
  extensionPath: "/fake/ext",
  workspaceFolders: ["/fake/ws"],
  activeFilePath: undefined,
};

function makeDispatcher(result: Result<unknown>) {
  return vi.fn(async (_cmd: Command, _ctx: CommandContext) => result);
}

describe("chat.delegate", () => {
  it("returns CHAT_DELEGATE_NO_GENERATE_FN when no generateProseFn provided", async () => {
    const logger = new MockLogger();
    const dispatcher = makeDispatcher(success({ branch: "main" }));
    const handler = createDelegateHandler(dispatcher, logger);

    const result = await handler(mockCtx, { task: "review my changes" });
    const err = assertFailure(result);
    expect(err.code).toBe("CHAT_DELEGATE_NO_GENERATE_FN");
    expect(dispatcher).not.toHaveBeenCalled();
  });

  it("classifies task, dispatches correct command, and returns result", async () => {
    const logger = new MockLogger();
    const dispatchValue = { verdict: "LGTM", summary: "Looks good", comments: [] };
    const dispatcher = makeDispatcher(success(dispatchValue));

    const generateProseFn: GenerateProseFn = vi.fn(async () => success("git.reviewPR"));
    const handler = createDelegateHandler(dispatcher, logger, generateProseFn);

    const result = await handler(mockCtx, { task: "review my changes" });
    const value = assertSuccess(result);

    expect(value.dispatched).toBe(true);
    expect(value.commandName).toBe("git.reviewPR");
    expect(value.result).toEqual(dispatchValue);
    expect(dispatcher).toHaveBeenCalledWith(
      expect.objectContaining({ name: "git.reviewPR" }),
      mockCtx
    );
  });

  it("falls back to chat.context when LLM returns unrecognized command", async () => {
    const logger = new MockLogger();
    const contextValue = { gitBranch: "main", activeFile: undefined };
    const dispatcher = makeDispatcher(success(contextValue));

    const generateProseFn: GenerateProseFn = vi.fn(async () => success("not.a.real.command"));
    const handler = createDelegateHandler(dispatcher, logger, generateProseFn);

    const result = await handler(mockCtx, { task: "do something weird" });
    const value = assertSuccess(result);

    expect(value.commandName).toBe("chat.context");
    expect(dispatcher).toHaveBeenCalledWith(
      expect.objectContaining({ name: "chat.context" }),
      mockCtx
    );
  });

  it("propagates dispatcher errors as failures", async () => {
    const logger = new MockLogger();
    const dispatchErr = failure({
      code: "GIT_STATUS_ERROR",
      message: "git not found",
      context: "git.status",
    });
    const dispatcher = makeDispatcher(dispatchErr);

    const generateProseFn: GenerateProseFn = vi.fn(async () => success("git.status"));
    const handler = createDelegateHandler(dispatcher, logger, generateProseFn);

    const result = await handler(mockCtx, { task: "check status" });
    const err = assertFailure(result);
    expect(err.code).toBe("GIT_STATUS_ERROR");
  });

  it("classifyOnly: returns classification without dispatching", async () => {
    const logger = new MockLogger();
    const dispatcher = makeDispatcher(success({ branch: "main" }));

    const generateProseFn: GenerateProseFn = vi.fn(async () => success("git.reviewPR"));
    const handler = createDelegateHandler(dispatcher, logger, generateProseFn);

    const result = await handler(mockCtx, { task: "review my changes", classifyOnly: true });
    const value = assertSuccess(result);

    expect(value.dispatched).toBe(false);
    expect(value.commandName).toBe("git.reviewPR");
    expect(value.result).toBeNull();
    expect(value.classifiedParams).toEqual({});
    // Dispatcher should only have been called for workflow.list (discovery), not the classified command
    expect(dispatcher).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: "git.reviewPR" }),
      expect.anything()
    );
  });

  it("classifyOnly: returns workflow params for workflow.run classification", async () => {
    const logger = new MockLogger();
    const dispatcher = makeDispatcher(success({}));

    const generateProseFn: GenerateProseFn = vi.fn(async () => success("workflow.run:deploy"));
    const handler = createDelegateHandler(dispatcher, logger, generateProseFn);

    const result = await handler(mockCtx, { task: "run deploy pipeline", classifyOnly: true });
    const value = assertSuccess(result);

    expect(value.dispatched).toBe(false);
    expect(value.commandName).toBe("workflow.run");
    expect(value.classifiedParams).toEqual({ name: "deploy" });
    // Dispatcher should only have been called for workflow.list (discovery), not the classified command
    expect(dispatcher).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: "workflow.run" }),
      expect.anything()
    );
  });

  it("augments classifier prompt with available workflows", async () => {
    const logger = new MockLogger();
    const workflowListResult = success({
      workflows: [
        { name: "deploy", description: "Deploy to production" },
        { name: "ci", description: "Run CI pipeline" },
      ],
    });
    const dispatchValue = { verdict: "LGTM" };

    const dispatcher = vi.fn(async (cmd: Command, _ctx: CommandContext) => {
      if (cmd.name === "workflow.list") return workflowListResult;
      return success(dispatchValue);
    });

    const generateProseFn: GenerateProseFn = vi.fn(async () => success("git.reviewPR"));
    const handler = createDelegateHandler(dispatcher, logger, generateProseFn);

    await handler(mockCtx, { task: "review my changes" });

    // Verify the generateProseFn was called with augmented prompt
    expect(generateProseFn).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("workflow.run:deploy"),
      })
    );
    expect(generateProseFn).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("Deploy to production"),
      })
    );
  });

  it("workflow discovery failure does not break classification", async () => {
    const logger = new MockLogger();
    const dispatcher = vi.fn(async (cmd: Command, _ctx: CommandContext) => {
      if (cmd.name === "workflow.list") throw new Error("workflow engine down");
      return success({ branch: "main" });
    });

    const generateProseFn: GenerateProseFn = vi.fn(async () => success("git.status"));
    const handler = createDelegateHandler(dispatcher, logger, generateProseFn);

    const result = await handler(mockCtx, { task: "show status" });
    const value = assertSuccess(result);

    expect(value.dispatched).toBe(true);
    expect(value.commandName).toBe("git.status");
  });
});
