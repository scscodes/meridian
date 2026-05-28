import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  commands: { executeCommand: vi.fn() },
  window: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    createWebviewPanel: vi.fn(),
  },
  workspace: { workspaceFolders: undefined, fs: { writeFile: vi.fn() } },
  Uri: { file: (fsPath: string) => ({ fsPath }), joinPath: (..._: unknown[]) => ({}) },
  ViewColumn: { One: 1 },
}));

import { AnalyticsWebviewProvider } from "../src/infrastructure/webview-provider";

interface PostedMessage { type: string; payload?: unknown }

function makeProvider(): {
  provider: AnalyticsWebviewProvider;
  posted: PostedMessage[];
  setFilter: (fn: () => Promise<unknown>) => void;
} {
  let filterFn: () => Promise<unknown> = async () => ({});
  const provider = new AnalyticsWebviewProvider(
    { fsPath: "/" } as never,
    "/ws",
    async (opts) => filterFn() as never
  );
  const posted: PostedMessage[] = [];
  (provider as unknown as { panel: unknown }).panel = {
    webview: { postMessage: (m: PostedMessage) => { posted.push(m); } },
  };
  return { provider, posted, setFilter: (fn) => { filterFn = fn; } };
}

describe("BaseWebviewProvider loading protocol", () => {
  it("posts loading before init on a successful refresh", async () => {
    const { provider, posted, setFilter } = makeProvider();
    setFilter(async () => ({ summary: "ok" }));
    await (provider as unknown as { handleMessage: (m: PostedMessage) => Promise<void> })
      .handleMessage({ type: "refresh", payload: { period: "3mo" } } as never);
    expect(posted.map(m => m.type)).toEqual(["loading", "init"]);
  });

  it("posts loading then error when the underlying refresh throws", async () => {
    const { provider, posted, setFilter } = makeProvider();
    setFilter(async () => { throw new Error("boom"); });
    await (provider as unknown as { handleMessage: (m: PostedMessage) => Promise<void> })
      .handleMessage({ type: "refresh", payload: { period: "3mo" } } as never);
    expect(posted.map(m => m.type)).toEqual(["loading", "error"]);
    expect(posted[1]!.payload).toBe("boom");
  });

  it("passes through non-refresh/filter messages without posting loading", async () => {
    const { provider, posted } = makeProvider();
    await (provider as unknown as { handleMessage: (m: PostedMessage) => Promise<void> })
      .handleMessage({ type: "openFile", payload: "x" } as never);
    expect(posted.find(m => m.type === "loading")).toBeUndefined();
  });

  it("posts loading before init on a filter message (period selector)", async () => {
    const { provider, posted, setFilter } = makeProvider();
    setFilter(async () => ({ summary: "filtered" }));
    await (provider as unknown as { handleMessage: (m: PostedMessage) => Promise<void> })
      .handleMessage({ type: "filter", payload: { period: "1mo" } } as never);
    expect(posted.map(m => m.type)).toEqual(["loading", "init"]);
  });
});
