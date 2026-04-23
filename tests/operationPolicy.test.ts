import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, showInformationMessageMock, writeTextMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  showInformationMessageMock: vi.fn(),
  writeTextMock: vi.fn(),
}));

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: getMock,
    }),
  },
  window: {
    showInformationMessage: showInformationMessageMock,
  },
  env: {
    clipboard: {
      writeText: writeTextMock,
    },
  },
}));

import {
  copyWithPolicy,
  getAllowedGitHosts,
  getGitNetworkMode,
  isSensitiveLoggingEnabled,
  sanitizeForLogs,
} from "../src/security/operation-policy";

describe("operation policy", () => {
  beforeEach(() => {
    getMock.mockReset();
    showInformationMessageMock.mockReset();
    writeTextMock.mockReset();
  });

  it("sanitizes sensitive log content", () => {
    const sanitized = sanitizeForLogs('token=ghp_abcdefghijklmnopqrstuvwxyz123456');
    expect(sanitized).toContain("[REDACTED");
  });

  it("reports sensitive logging mode correctly", () => {
    getMock.mockReturnValueOnce("allow");
    expect(isSensitiveLoggingEnabled()).toBe(true);
  });

  it("reads git network mode with safe fallback", () => {
    getMock.mockReturnValueOnce("deny");
    expect(getGitNetworkMode()).toBe("deny");
    getMock.mockReturnValueOnce("weird");
    expect(getGitNetworkMode()).toBe("prompt");
  });

  it("normalizes git host allowlist", () => {
    getMock.mockReturnValueOnce([" GitHub.com ", ""]);
    expect(getAllowedGitHosts()).toEqual(["github.com"]);
  });

  it("prompts for clipboard copy when auto copy disabled", async () => {
    getMock.mockReturnValueOnce(false);
    showInformationMessageMock.mockResolvedValue("Copy to Clipboard");
    const copied = await copyWithPolicy("hello", "Summary");
    expect(copied).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith("hello");
  });
});
