import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("vscode", () => ({
  commands: { executeCommand: vi.fn() },
  window: { showErrorMessage: vi.fn(), createWebviewPanel: vi.fn() },
  Uri: {
    file: (fsPath: string) => ({ fsPath }),
    joinPath: (...parts: Array<{ fsPath?: string } | string>) => ({
      fsPath: parts.map((p) => (typeof p === "string" ? p : p.fsPath ?? "")).join("/"),
    }),
  },
  ViewColumn: { One: 1 },
}));

import * as vscode from "vscode";
import { SessionBriefingWebviewProvider } from "../src/infrastructure/webview-provider";
import { SessionBriefingReport } from "../src/domains/git/types";

function makeProvider(): SessionBriefingWebviewProvider {
  return new SessionBriefingWebviewProvider(
    { fsPath: "/ws" } as unknown as vscode.Uri,
    "/ws",
    async () => {
      throw new Error("unused");
    }
  );
}

const base: SessionBriefingReport = {
  generatedAt: "2026-05-19T00:00:00.000Z",
  branch: "develop",
  isDirty: true,
  staged: 1,
  unstaged: 2,
  untracked: 0,
  recentCommits: [],
  uncommittedFiles: [],
  flags: [],
  summary: "s",
};

describe("SessionBriefingWebviewProvider.reportToCsv", () => {
  it("emits Activity + Hygiene sections with new retained fields, comma/quote-escaped", () => {
    const report: SessionBriefingReport = {
      ...base,
      activityWindow: {
        period: "3mo",
        commitsInWindow: 42,
        filesTouched: 18,
        topContributors: [{ name: "Last, First", commits: 20 }],
        trends: { commitDirection: "up", commitConfidence: 0.75, volatilityDirection: "stable" },
        topChurnFiles: [{ path: "src/a,b.ts", volatility: 9, risk: "high" }],
      },
      hygieneSnapshot: {
        scannedAt: "2026-05-19T00:00:00.000Z",
        deadFileCount: 3,
        largeFileCount: 1,
        logFileCount: 0,
        deadCodeItemCount: 7,
        deadCodeSample: [{ filePath: "/abs/x.ts", line: 12, message: 'unused "y"' }],
      },
    };

    const csv = (makeProvider() as unknown as { reportToCsv(r: SessionBriefingReport): string }).reportToCsv(report);

    expect(csv).toContain("\nActivity\n");
    expect(csv).toContain("Commit Trend,up");
    expect(csv).toContain("Commit Confidence,0.75");
    expect(csv).toContain("Volatility Trend,stable");
    expect(csv).toContain('"Last, First",20');
    expect(csv).toContain("Top Churn Files");
    expect(csv).toContain('"src/a,b.ts",9,high');
    expect(csv).toContain("\nHygiene\n");
    expect(csv).toContain("Dead Code Items,7");
    expect(csv).toContain("Dead Code Sample");
    expect(csv).toContain('"/abs/x.ts",12,"unused ""y"""');
  });

  it("omits Activity/Hygiene sections when those slices are absent (fail-soft)", () => {
    const csv = (makeProvider() as unknown as { reportToCsv(r: SessionBriefingReport): string }).reportToCsv(base);

    expect(csv).not.toContain("\nActivity\n");
    expect(csv).not.toContain("\nHygiene\n");
    expect(csv).toContain("Recent Commits");
  });
});
