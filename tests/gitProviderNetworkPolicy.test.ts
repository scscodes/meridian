import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGitProvider } from "../src/infrastructure/git-provider";

const { execFileMock, getMock, showWarningMessageMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
  getMock: vi.fn(),
  showWarningMessageMock: vi.fn(),
}));

vi.mock("child_process", () => ({
  execFile: execFileMock,
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

function mockGitCommandResponses(stdoutByCommand: Record<string, string>) {
  execFileMock.mockImplementation(
    (
      _bin: string,
      args: string[],
      _opts: unknown,
      cb: (err: Error | null, result?: { stdout: string; stderr?: string }) => void
    ) => {
      const key = args.join(" ");
      const stdout = stdoutByCommand[key];
      if (stdout !== undefined) {
        cb(null, { stdout });
      } else {
        cb(new Error(`Unexpected command: ${key}`));
      }
    }
  );
}

describe("git provider network policy", () => {
  beforeEach(() => {
    execFileMock.mockReset();
    getMock.mockReset();
    showWarningMessageMock.mockReset();
  });

  it("blocks fetch when git network mode is deny", async () => {
    getMock.mockImplementation((_key: string, fallback: unknown) => {
      if (_key === "security.gitNetwork.mode") return "deny";
      if (_key === "security.gitNetwork.allowedHosts") return [];
      return fallback;
    });

    const provider = createGitProvider("/workspace");
    const result = await provider.fetch("origin");
    expect(result.kind).toBe("err");
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("blocks fetch when host is not in allowlist", async () => {
    getMock.mockImplementation((_key: string, fallback: unknown) => {
      if (_key === "security.gitNetwork.mode") return "allow";
      if (_key === "security.gitNetwork.allowedHosts") return ["gitlab.com"];
      return fallback;
    });
    mockGitCommandResponses({
      "remote get-url origin": "https://github.com/acme/repo.git",
    });

    const provider = createGitProvider("/workspace");
    const result = await provider.fetch("origin");
    expect(result.kind).toBe("err");
  });

  it("prompts and runs fetch when approved", async () => {
    getMock.mockImplementation((_key: string, fallback: unknown) => {
      if (_key === "security.gitNetwork.mode") return "prompt";
      if (_key === "security.gitNetwork.allowedHosts") return [];
      return fallback;
    });
    showWarningMessageMock.mockResolvedValue("Continue");
    mockGitCommandResponses({
      "remote get-url origin": "https://github.com/acme/repo.git",
      "fetch origin": "",
    });

    const provider = createGitProvider("/workspace");
    const result = await provider.fetch("origin");
    expect(result.kind).toBe("ok");
    expect(showWarningMessageMock).toHaveBeenCalled();
  });

  it("applies deny policy to pull as well", async () => {
    getMock.mockImplementation((_key: string, fallback: unknown) => {
      if (_key === "security.gitNetwork.mode") return "deny";
      if (_key === "security.gitNetwork.allowedHosts") return [];
      return fallback;
    });
    mockGitCommandResponses({
      "rev-parse --abbrev-ref HEAD": "feature",
      "config branch.feature.remote": "origin",
    });
    const provider = createGitProvider("/workspace");
    const result = await provider.pull();
    expect(result.kind).toBe("err");
  });

  it("fails closed when remote URL cannot be resolved and allowlist exists", async () => {
    getMock.mockImplementation((_key: string, fallback: unknown) => {
      if (_key === "security.gitNetwork.mode") return "allow";
      if (_key === "security.gitNetwork.allowedHosts") return ["github.com"];
      return fallback;
    });
    execFileMock.mockImplementation(
      (
        _bin: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, result?: { stdout: string; stderr?: string }) => void
      ) => {
        cb(new Error("remote lookup failed"));
      }
    );

    const provider = createGitProvider("/workspace");
    const result = await provider.fetch("origin");
    expect(result.kind).toBe("err");
  });

  it("uses tracked branch remote for pull policy checks", async () => {
    getMock.mockImplementation((_key: string, fallback: unknown) => {
      if (_key === "security.gitNetwork.mode") return "prompt";
      if (_key === "security.gitNetwork.allowedHosts") return [];
      return fallback;
    });
    showWarningMessageMock.mockResolvedValue("Continue");
    mockGitCommandResponses({
      "rev-parse --abbrev-ref HEAD": "feature",
      "config branch.feature.remote": "upstream",
      "remote get-url upstream": "https://gitlab.com/acme/repo.git",
      pull: "",
    });

    const provider = createGitProvider("/workspace");
    const result = await provider.pull();
    expect(result.kind).toBe("ok");
    expect(execFileMock.mock.calls.some((c) => (c[1] as string[]).join(" ") === "remote get-url upstream")).toBe(true);
  });
});
