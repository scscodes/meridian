import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, showWarningMessageMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  showWarningMessageMock: vi.fn(),
}));

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: getMock,
    }),
  },
  window: {
    showWarningMessage: showWarningMessageMock,
  },
}));

import { enforceLmEgressPolicy, sanitizeLmPayload } from "../src/security/lm-policy";

describe("lm policy", () => {
  beforeEach(() => {
    getMock.mockReset();
    showWarningMessageMock.mockReset();
  });

  it("blocks when mode is deny", async () => {
    getMock.mockReturnValue("deny");
    await expect(enforceLmEgressPolicy("test.feature")).resolves.toBe(false);
  });

  it("allows when mode is allow", async () => {
    getMock.mockReturnValue("allow");
    await expect(enforceLmEgressPolicy("test.feature")).resolves.toBe(true);
  });

  it("prompts when mode is prompt", async () => {
    getMock.mockReturnValue("prompt");
    showWarningMessageMock.mockResolvedValue("Continue");
    await expect(enforceLmEgressPolicy("test.feature")).resolves.toBe(true);
    expect(showWarningMessageMock).toHaveBeenCalled();
  });

  it("fails safe on unknown mode by prompting", async () => {
    getMock.mockReturnValue("weird-value");
    showWarningMessageMock.mockResolvedValue(undefined);
    await expect(enforceLmEgressPolicy("test.feature")).resolves.toBe(false);
    expect(showWarningMessageMock).toHaveBeenCalled();
  });

  it("redacts token-like content", () => {
    const payload = 'token="ghp_abcdefghijklmnopqrstuvwxyz123456"';
    const sanitized = sanitizeLmPayload(payload);
    expect(sanitized).toContain("[REDACTED");
  });

  it("truncates oversized payloads", () => {
    const oversized = "a".repeat(13000);
    const sanitized = sanitizeLmPayload(oversized);
    expect(sanitized).toContain("[TRUNCATED]");
  });
});
