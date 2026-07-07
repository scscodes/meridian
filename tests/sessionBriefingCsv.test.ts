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
  flagItems: [],
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

    expect(csv.startsWith("Session Briefing Report\n")).toBe(true);
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

  it("emits a Pending-Change Risk section, comma-escaped, with new/cold blanks", () => {
    const report: SessionBriefingReport = {
      ...base,
      pendingChangeRisk: {
        totalChanged: 3,
        hotspotCount: 1,
        capped: false,
        files: [
          { path: "src/hot.ts", status: "M", churn: 40, volatility: 8.2, risk: "high" },
          { path: "src/a,b.ts", status: "A", churn: null, volatility: null, risk: "new" },
          { path: "src/quiet.ts", status: "M", churn: null, volatility: null, risk: "cold" },
        ],
      },
    };

    const csv = (makeProvider() as unknown as { reportToCsv(r: SessionBriefingReport): string }).reportToCsv(report);

    expect(csv).toContain("\nPending-Change Risk\n");
    expect(csv).toContain("Total Changed,3");
    expect(csv).toContain("High-Risk,1");
    expect(csv).toContain("Capped,false");
    expect(csv).toContain('"src/hot.ts",M,40,8.2,high');
    expect(csv).toContain('"src/a,b.ts",A,,,new');
    expect(csv).toContain('"src/quiet.ts",M,,,cold');
  });

  it("emits a Pending-Change Companions section, comma-escaped, with becauseOf joined", () => {
    const report: SessionBriefingReport = {
      ...base,
      pendingChangeCompanions: {
        count: 2,
        capped: false,
        files: [
          { path: "src/a,b.ts", count: 6, coChangeRate: 0.9, becauseOf: ["src/handler.ts", "src/x.ts"] },
          { path: "src/c.ts", count: 3, coChangeRate: 0.5, becauseOf: ["src/handler.ts"] },
        ],
      },
    };

    const csv = (makeProvider() as unknown as { reportToCsv(r: SessionBriefingReport): string }).reportToCsv(report);

    expect(csv).toContain("\nPending-Change Companions\n");
    expect(csv).toContain("Suggested,2");
    expect(csv).toContain("Capped,false");
    expect(csv).toContain("Path,Co-Changes,Co-change %,Ships With");
    expect(csv).toContain('"src/a,b.ts",6,90,"src/handler.ts;src/x.ts"');
    expect(csv).toContain('"src/c.ts",3,50,"src/handler.ts"');
  });

  it("omits Activity/Hygiene/Pending-Change sections when those slices are absent (fail-soft)", () => {
    const csv = (makeProvider() as unknown as { reportToCsv(r: SessionBriefingReport): string }).reportToCsv(base);

    expect(csv).not.toContain("\nActivity\n");
    expect(csv).not.toContain("\nHygiene\n");
    expect(csv).not.toContain("\nPending-Change Risk\n");
    expect(csv).not.toContain("\nPending-Change Companions\n");
    expect(csv).toContain("Recent Commits");
  });
});
