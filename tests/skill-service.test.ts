import { describe, it, expect, vi } from "vitest";
import { createSkillDomain } from "../src/domains/skill/service";
import { createMockContext, MockLogger } from "./fixtures";
import { RunLog } from "../src/infrastructure/run-log";
import { RunEventV1 } from "../src/types";

function createMemoryRunLog(): { runLog: RunLog; events: RunEventV1[] } {
  const events: RunEventV1[] = [];
  const runLog: RunLog = {
    append: async (event) => {
      events.push(event);
      return { kind: "ok", value: undefined };
    },
    appendMany: async (incoming) => {
      events.push(...incoming);
      return { kind: "ok", value: undefined };
    },
    readByRunId: async (runId) => ({
      kind: "ok",
      value: events.filter((event) => event.runId === runId),
    }),
    readLatest: async (limit) => ({
      kind: "ok",
      value: events.slice(-limit),
    }),
  };
  return { runLog, events };
}

describe("SkillDomainService run-log lifecycle", () => {
  it("emits skill start and complete with correlated runId", async () => {
    const logger = new MockLogger();
    const { runLog, events } = createMemoryRunLog();
    const dispatcher = vi.fn().mockResolvedValue({
      kind: "ok",
      value: {},
    });
    const domain = createSkillDomain(logger, dispatcher, runLog);
    const handler = domain.handlers["skill.overview"];
    expect(handler).toBeTruthy();

    const result = await handler!(
      { ...createMockContext(), runId: "outer-run-1" },
      {} as never
    );
    expect(result.kind).toBe("ok");
    expect(events).toHaveLength(2);
    expect(events[0].phase).toBe("start");
    expect(events[1].phase).toBe("complete");
    expect(events[0].source).toBe("skill");
    expect(events[0].skillName).toBe("skill.overview");
    expect(events[0].runId).toBe("outer-run-1");
    expect(events[1].runId).toBe("outer-run-1");
  });

  it("emits fail event when a skill step fails", async () => {
    const logger = new MockLogger();
    const { runLog, events } = createMemoryRunLog();
    const dispatcher = vi
      .fn()
      .mockResolvedValueOnce({
        kind: "err",
        error: { code: "GIT_STATUS_ERROR", message: "no repo" },
      });
    const domain = createSkillDomain(logger, dispatcher, runLog);
    const handler = domain.handlers["skill.overview"];
    expect(handler).toBeTruthy();

    const result = await handler!(
      { ...createMockContext(), runId: "outer-run-2" },
      {} as never
    );
    expect(result.kind).toBe("err");
    expect(events).toHaveLength(2);
    expect(events[1].phase).toBe("fail");
    expect(events[1].errorCode).toBe("SKILL_STEP_FAILED");
    expect(events[1].skillName).toBe("skill.overview");
  });
});

