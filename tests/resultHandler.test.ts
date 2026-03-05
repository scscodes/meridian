import { describe, it, expect } from "vitest";
import { formatResultMessage } from "../src/infrastructure/result-handler";
import { success, failure } from "../src/types";
import type { Result } from "../src/types";

describe("formatResultMessage", () => {
  // -----------------------------------------------------------------------
  // 1. Error with known code (NO_CHANGES) → friendly message
  // -----------------------------------------------------------------------
  it("maps known error code to friendly message", () => {
    const result: Result<unknown> = failure({
      code: "NO_CHANGES",
      message: "There are no staged changes",
    });
    const msg = formatResultMessage("git.smartCommit", result);

    expect(msg.level).toBe("error");
    expect(msg.message).toContain("No changes to commit.");
  });

  // -----------------------------------------------------------------------
  // 2. Error with unknown code → raw error.message used
  // -----------------------------------------------------------------------
  it("falls back to raw error message for unknown code", () => {
    const result: Result<unknown> = failure({
      code: "SOME_UNKNOWN_CODE",
      message: "Something unexpected happened",
    });
    const msg = formatResultMessage("git.commit", result);

    expect(msg.level).toBe("error");
    expect(msg.message).toContain("Something unexpected happened");
  });

  // -----------------------------------------------------------------------
  // 3. git.status success → branch name and dirty/clean
  // -----------------------------------------------------------------------
  it("formats git.status success with branch and dirty state", () => {
    const result = success({
      branch: "main",
      isDirty: true,
      staged: 2,
      unstaged: 3,
      untracked: 1,
    });
    const msg = formatResultMessage("git.status", result);

    expect(msg.level).toBe("info");
    expect(msg.message).toContain("main");
    expect(msg.message).toContain("dirty");
    expect(msg.message).toContain("staged: 2");
    expect(msg.message).toContain("unstaged: 3");
    expect(msg.message).toContain("untracked: 1");
  });

  // -----------------------------------------------------------------------
  // 4. hygiene.scan success → dead/large/logs counts
  // -----------------------------------------------------------------------
  it("formats hygiene.scan success with category counts", () => {
    const result = success({
      deadFiles: ["a.tmp"],
      largeFiles: [
        { path: "b.bin", sizeBytes: 12000000 },
        { path: "c.bin", sizeBytes: 15000000 },
      ],
      logFiles: [],
      markdownFiles: [],
      deadCode: { items: [], tsconfigPath: null, durationMs: 0, fileCount: 0 },
    });
    const msg = formatResultMessage("hygiene.scan", result);

    expect(msg.level).toBe("info");
    expect(msg.message).toContain("dead: 1");
    expect(msg.message).toContain("large: 2");
    expect(msg.message).toContain("logs: 0");
  });

  // -----------------------------------------------------------------------
  // 5. workflow.run success → workflow name and step count
  // -----------------------------------------------------------------------
  it("formats workflow.run success with name and step count", () => {
    const result = success({
      workflowName: "deploy",
      success: true,
      duration: 5000,
      stepCount: 3,
    });
    const msg = formatResultMessage("workflow.run", result);

    expect(msg.level).toBe("info");
    expect(msg.message).toContain("deploy");
    expect(msg.message).toContain("3 step(s)");
  });

  // -----------------------------------------------------------------------
  // 6. workflow.run failure → error code maps to friendly message
  //    (failures return Result<err>, not success({ success: false }))
  // -----------------------------------------------------------------------
  it("maps WORKFLOW_EXECUTION_FAILED to friendly error message", () => {
    const result: Result<unknown> = failure({
      code: "WORKFLOW_EXECUTION_FAILED",
      message: "Step 'build' timed out",
    });
    const msg = formatResultMessage("workflow.run", result);

    expect(msg.level).toBe("error");
    expect(msg.message).toContain("Workflow execution failed");
  });

  // -----------------------------------------------------------------------
  // 6b. WORKFLOW_NOT_FOUND → friendly error
  // -----------------------------------------------------------------------
  it("maps WORKFLOW_NOT_FOUND to friendly error message", () => {
    const result: Result<unknown> = failure({
      code: "WORKFLOW_NOT_FOUND",
      message: "Workflow not found: deploy",
    });
    const msg = formatResultMessage("workflow.run", result);

    expect(msg.level).toBe("error");
    expect(msg.message).toContain("Workflow not found");
  });

  // -----------------------------------------------------------------------
  // 7. chat.delegate success → "Delegated"
  // -----------------------------------------------------------------------
  it("formats chat.delegate success with delegated command", () => {
    const result = success({
      commandName: "git.status",
    });
    const msg = formatResultMessage("chat.delegate", result);

    expect(msg.level).toBe("info");
    expect(msg.message).toContain("Delegated");
    expect(msg.message).toContain("git.status");
  });

  // -----------------------------------------------------------------------
  // 7b. agent.execute success → agentId + command + timing
  // -----------------------------------------------------------------------
  it("formats agent.execute success with agent id and command", () => {
    const result = success({
      agentId: "my-agent",
      success: true,
      durationMs: 1200,
      logs: [],
      executedCommand: "git.status",
      agentCapabilities: ["git.status"],
    });
    const msg = formatResultMessage("agent.execute", result);

    expect(msg.level).toBe("info");
    expect(msg.message).toContain("my-agent");
    expect(msg.message).toContain("git.status");
    expect(msg.message).toContain("1200ms");
  });

  // -----------------------------------------------------------------------
  // 7c. agent.execute internal failure → error level with message
  //     (agent always wraps failures in success({ success: false }))
  // -----------------------------------------------------------------------
  it("formats agent.execute internal failure as error with reason", () => {
    const result = success({
      agentId: "my-agent",
      success: false,
      durationMs: 50,
      logs: [],
      error: "Command 'git.status' returned an error",
      executedCommand: "git.status",
      agentCapabilities: ["git.status"],
    });
    const msg = formatResultMessage("agent.execute", result);

    expect(msg.level).toBe("error");
    expect(msg.message).toContain("my-agent");
    expect(msg.message).toContain("failed");
    expect(msg.message).toContain("Command 'git.status' returned an error");
  });

  // -----------------------------------------------------------------------
  // 7d. AGENT_NOT_FOUND → friendly error
  // -----------------------------------------------------------------------
  it("maps AGENT_NOT_FOUND to friendly error message", () => {
    const result: Result<unknown> = failure({
      code: "AGENT_NOT_FOUND",
      message: "Agent 'foo' not found",
    });
    const msg = formatResultMessage("agent.execute", result);

    expect(msg.level).toBe("error");
    expect(msg.message).toContain("Agent not found");
  });

  // -----------------------------------------------------------------------
  // 8. Unknown command success → generic OK
  // -----------------------------------------------------------------------
  it("returns generic OK for unrecognized command names", () => {
    const result = success({ anything: true });
    const msg = formatResultMessage("custom.unknown", result);

    expect(msg.level).toBe("info");
    expect(msg.message).toContain("custom.unknown");
    expect(msg.message).toContain("OK");
  });
});
