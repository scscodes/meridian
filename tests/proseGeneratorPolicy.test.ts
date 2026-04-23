import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateProse } from "../src/infrastructure/prose-generator";

const {
  sendRequestMock,
  selectModelMock,
  enforceLmEgressPolicyMock,
  sanitizeLmPayloadMock,
} = vi.hoisted(() => ({
  sendRequestMock: vi.fn(),
  selectModelMock: vi.fn(),
  enforceLmEgressPolicyMock: vi.fn(),
  sanitizeLmPayloadMock: vi.fn((v: string) => `SANITIZED:${v}`),
}));

vi.mock("../src/infrastructure/model-selector", () => ({
  selectModel: selectModelMock,
}));

vi.mock("../src/security/lm-policy", () => ({
  enforceLmEgressPolicy: enforceLmEgressPolicyMock,
  sanitizeLmPayload: sanitizeLmPayloadMock,
}));

vi.mock("vscode", () => ({
  LanguageModelChatMessage: {
    User: (content: string) => ({ role: "user", content }),
  },
  CancellationTokenSource: class {
    token = {};
  },
}));

function createModel() {
  return {
    sendRequest: sendRequestMock,
  };
}

describe("prose generator LM policy integration", () => {
  beforeEach(() => {
    sendRequestMock.mockReset();
    selectModelMock.mockReset();
    enforceLmEgressPolicyMock.mockReset();
    sanitizeLmPayloadMock.mockClear();
  });

  it("blocks request when LM egress policy denies", async () => {
    selectModelMock.mockResolvedValue(createModel());
    enforceLmEgressPolicyMock.mockResolvedValue(false);

    const result = await generateProse({
      domain: "git",
      systemPrompt: "Summarize",
      data: { token: "abc" },
    });

    expect(result.kind).toBe("err");
    if (result.kind === "err") {
      expect(result.error.code).toBe("LM_EGRESS_BLOCKED");
    }
    expect(sendRequestMock).not.toHaveBeenCalled();
  });

  it("sanitizes payload before sendRequest", async () => {
    selectModelMock.mockResolvedValue(createModel());
    enforceLmEgressPolicyMock.mockResolvedValue(true);
    sendRequestMock.mockResolvedValue({
      text: (async function* () {
        yield "ok";
      })(),
    });

    const result = await generateProse({
      domain: "git",
      systemPrompt: "Summarize",
      data: { secret: "raw-value" },
    });

    expect(result.kind).toBe("ok");
    expect(sanitizeLmPayloadMock).toHaveBeenCalledTimes(1);
    const messages = sendRequestMock.mock.calls[0]?.[0] as Array<{ content: string }>;
    expect(messages[0]?.content).toContain("SANITIZED:");
  });
});
