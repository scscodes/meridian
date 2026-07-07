import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  commands: { executeCommand: vi.fn() },
  window: {
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showSaveDialog: vi.fn(),
    createWebviewPanel: vi.fn(),
  },
  workspace: { fs: { writeFile: vi.fn() } },
  Uri: { file: (fsPath: string) => ({ fsPath }) },
  ViewColumn: { One: 1 },
}));

import { mdEscape, reportMdHeader, REPORT_LABELS } from "../src/report-labels";
import { gitReportToMd } from "../src/domains/git/analytics-service";
import {
  HygieneAnalyticsWebviewProvider,
  SessionBriefingWebviewProvider,
} from "../src/infrastructure/webview-provider";
import type { GitAnalyticsReport } from "../src/domains/git/analytics-types";
import type { HygieneAnalyticsReport } from "../src/domains/hygiene/analytics-types";
import type { SessionBriefingReport } from "../src/domains/git/types";

const WHEN = new Date("2026-07-07T12:00:00.000Z");

function makeGitReport(): GitAnalyticsReport {
  return {
    period: "3mo",
    generatedAt: WHEN,
    summary: {
      totalCommits: 2,
      totalAuthors: 1,
      totalFilesModified: 2,
      totalLinesAdded: 10,
      totalLinesDeleted: 4,
      commitFrequency: 0.5,
      averageCommitSize: 7,
      churnRate: 1.25,
    },
    commits: [],
    files: [
      {
        path: "src/pipe|and`tick.ts",
        commitCount: 2,
        insertions: 8,
        deletions: 3,
        volatility: 5.5,
        authors: ["Ada | Lovelace"],
        lastModified: WHEN,
        risk: "high",
      },
    ],
    authors: [
      {
        name: "Ada | Lovelace",
        commits: 2,
        insertions: 10,
        deletions: 4,
        filesChanged: 2,
        lastActive: WHEN,
      },
    ],
    trends: {
      commitTrend: { slope: 0, direction: "stable", confidence: 0.5 },
      volatilityTrend: { slope: 0, direction: "stable" },
    },
    commitFrequency: { labels: ["Week 1"], data: [2] },
    churnFiles: [],
    topAuthors: [],
    coChange: [{ a: "a.ts", b: "b|c.ts", count: 3, coChangeRate: 0.75 }],
  };
}

function makeBriefingReport(): SessionBriefingReport {
  return {
    generatedAt: "2026-07-07T12:00:00.000Z",
    branch: "develop",
    isDirty: true,
    staged: 1,
    unstaged: 1,
    untracked: 0,
    recentCommits: [
      {
        shortHash: "abc1234",
        author: "Ada",
        message: "fix: handle `weird|pipe`\nwith a second line",
        insertions: 3,
        deletions: 1,
      },
    ],
    uncommittedFiles: [{ path: "src/a|b.ts", status: "M" }],
    flags: [],
    flagItems: [],
    activityWindow: {
      period: "3mo",
      commitsInWindow: 2,
      filesTouched: 3,
      topContributors: [{ name: "Ada | Lovelace", commits: 2 }],
    },
    summary: "Quiet session.",
  };
}

describe("markdown export helpers", () => {
  it("reportMdHeader mirrors reportCsvHeader as an H1", () => {
    expect(reportMdHeader(REPORT_LABELS.gitAnalytics)).toBe("# Git Analytics Report");
  });

  it("mdEscape escapes pipes and backticks and collapses newlines", () => {
    expect(mdEscape("a|b")).toBe("a\\|b");
    expect(mdEscape("run `cmd`")).toBe("run \\`cmd\\`");
    expect(mdEscape("line one\nline two\r\nline three")).toBe("line one line two line three");
    expect(mdEscape("back\\slash")).toBe("back\\\\slash");
  });
});

describe("gitReportToMd", () => {
  it("mirrors the CSV section structure with escaped table cells", () => {
    const md = gitReportToMd(makeGitReport());

    expect(md.startsWith("# Git Analytics Report")).toBe(true);
    expect(md).toContain("## Summary");
    expect(md).toContain("## Files");
    expect(md).toContain("## Authors");
    expect(md).toContain("## Change Companions");

    // Real values off the report, escaped for table cells.
    expect(md).toContain("| src/pipe\\|and\\`tick.ts | 2 | 8 | 3 | 5.50 | high |");
    expect(md).toContain("| Ada \\| Lovelace | 2 | 10 | 4 | 2 |");
    expect(md).toContain("| a.ts | b\\|c.ts | 3 | 75 |");
    expect(md).toContain("- **Period:** 3mo");
    expect(md).toContain(`- **Generated:** ${WHEN.toISOString()}`);
  });

  it("omits the Change Companions section when there are no pairs", () => {
    const report = { ...makeGitReport(), coChange: [] };
    expect(gitReportToMd(report)).not.toContain("Change Companions");
  });
});

describe("SessionBriefingWebviewProvider.reportToMarkdown", () => {
  it("renders commits and contributors with escaping, no row-breaking newlines", () => {
    const provider = new SessionBriefingWebviewProvider(
      { fsPath: "/ext" } as never,
      "/ws",
      async () => ({} as never)
    );
    const md: string = (provider as never as {
      reportToMarkdown(r: SessionBriefingReport): string;
    }).reportToMarkdown(makeBriefingReport());

    expect(md.startsWith("# Session Briefing Report")).toBe(true);
    expect(md).toContain("## Recent Commits");
    expect(md).toContain("## Uncommitted Files");
    expect(md).toContain("### Top Contributors");

    // Multi-line commit message stays a single table row.
    const commitRow = md.split("\n").find((l) => l.includes("abc1234"));
    expect(commitRow).toBe(
      "| abc1234 | Ada | fix: handle \\`weird\\|pipe\\` with a second line | 3 | 1 |"
    );
    expect(md).toContain("| src/a\\|b.ts | M |");
    expect(md).toContain("| Ada \\| Lovelace | 2 |");
    // Optional slices absent from the payload stay absent from the export.
    expect(md).not.toContain("## Hygiene");
    expect(md).not.toContain("## Pending-Change Risk");
  });
});

describe("HygieneAnalyticsWebviewProvider.reportToMarkdown", () => {
  it("renders summary bullets and the files table with escaping", () => {
    const provider = new HygieneAnalyticsWebviewProvider(
      { fsPath: "/ext" } as never,
      async () => ({} as never)
    );
    // Only the fields the markdown builder consumes — same idiom as the CSV
    // export tests; the serializer output itself is real.
    const report = {
      generatedAt: WHEN,
      workspaceRoot: "/ws",
      summary: { totalFiles: 3, pruneCount: 1, pruneEstimateSizeBytes: 2048 },
      files: [
        {
          path: "logs/build|old`.log",
          sizeBytes: 2048,
          lineCount: 10,
          ageDays: 40,
          category: "log",
          isPruneCandidate: true,
        },
      ],
    } as unknown as HygieneAnalyticsReport;

    const md: string = (provider as never as {
      reportToMarkdown(r: HygieneAnalyticsReport): string;
    }).reportToMarkdown(report);

    expect(md.startsWith("# Hygiene Analytics Report")).toBe(true);
    expect(md).toContain(`- **Generated:** ${WHEN.toISOString()}`);
    expect(md).toContain("- **Total Files:** 3");
    expect(md).toContain("- **Estimated Savings:** 2.0 KB");
    expect(md).toContain("| logs/build\\|old\\`.log | 2048 | 10 | 40 | log | true |");
  });
});
