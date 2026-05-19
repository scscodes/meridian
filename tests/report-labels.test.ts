import { describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { REPORT_LABELS, reportCsvHeader } from "../src/report-labels";

vi.mock("vscode", () => ({
  commands: { executeCommand: vi.fn() },
  window: {
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showSaveDialog: vi.fn(),
    createWebviewPanel: vi.fn(),
  },
  workspace: { fs: { writeFile: vi.fn() } },
  Uri: {
    file: (fsPath: string) => ({ fsPath }),
    joinPath: (...parts: Array<{ fsPath?: string } | string>) => ({
      fsPath: parts.map((p) => (typeof p === "string" ? p : p.fsPath ?? "")).join("/"),
    }),
  },
  ViewColumn: { One: 1 },
}));

import {
  AnalyticsWebviewProvider,
  HygieneAnalyticsWebviewProvider,
  SessionBriefingWebviewProvider,
} from "../src/infrastructure/webview-provider";
import { COMMAND_MAP } from "../src/presentation/command-registry";

const ROOT = path.resolve(__dirname, "..");

function readH1(relativeHtmlPath: string): string {
  const html = fs.readFileSync(path.join(ROOT, relativeHtmlPath), "utf-8");
  const match = html.match(/<h1>([^<]+)<\/h1>/);
  expect(match, `missing <h1> in ${relativeHtmlPath}`).not.toBeNull();
  return match![1]!;
}

function readTitle(relativeHtmlPath: string): string {
  const html = fs.readFileSync(path.join(ROOT, relativeHtmlPath), "utf-8");
  const match = html.match(/<title>([^<]+)<\/title>/);
  expect(match, `missing <title> in ${relativeHtmlPath}`).not.toBeNull();
  return match![1]!;
}

describe("report labels", () => {
  it("defines canonical display names", () => {
    expect(REPORT_LABELS.sessionBriefing).toBe("Session Briefing");
    expect(REPORT_LABELS.gitAnalytics).toBe("Git Analytics");
    expect(REPORT_LABELS.hygieneAnalytics).toBe("Hygiene Analytics");
  });

  it("builds CSV headers from display names", () => {
    expect(reportCsvHeader(REPORT_LABELS.gitAnalytics)).toBe("Git Analytics Report");
    expect(reportCsvHeader(REPORT_LABELS.hygieneAnalytics)).toBe("Hygiene Analytics Report");
    expect(reportCsvHeader(REPORT_LABELS.sessionBriefing)).toBe("Session Briefing Report");
  });

  it("matches webview HTML h1 and title tags", () => {
    const panels = [
      {
        html: "src/domains/git/analytics-ui/index.html",
        label: REPORT_LABELS.gitAnalytics,
      },
      {
        html: "src/domains/hygiene/analytics-ui/index.html",
        label: REPORT_LABELS.hygieneAnalytics,
      },
      {
        html: "src/domains/git/session-briefing-ui/index.html",
        label: REPORT_LABELS.sessionBriefing,
      },
    ] as const;

    for (const { html, label } of panels) {
      expect(readH1(html)).toBe(label);
      expect(readTitle(html)).toBe(label);
    }
  });

  it("matches webview provider tab titles", () => {
    const extUri = { fsPath: ROOT } as import("vscode").Uri;

    const git = new AnalyticsWebviewProvider(extUri, "/ws", async () => ({} as never));
    const hygiene = new HygieneAnalyticsWebviewProvider(extUri, async () => ({} as never));
    const session = new SessionBriefingWebviewProvider(extUri, "/ws", async () => ({} as never));

    type WithTitle = { getViewTitle(): string };
    expect((git as unknown as WithTitle).getViewTitle()).toBe(REPORT_LABELS.gitAnalytics);
    expect((hygiene as unknown as WithTitle).getViewTitle()).toBe(REPORT_LABELS.hygieneAnalytics);
    expect((session as unknown as WithTitle).getViewTitle()).toBe(REPORT_LABELS.sessionBriefing);
  });

  it("matches COMMAND_MAP palette titles for the three report commands", () => {
    const mapTitle = (cmd: string): string | undefined =>
      COMMAND_MAP.find((e) => e.commandName === cmd)?.title;

    expect(mapTitle("git.showAnalytics")).toBe(REPORT_LABELS.gitAnalytics);
    expect(mapTitle("hygiene.showAnalytics")).toBe(REPORT_LABELS.hygieneAnalytics);
    expect(mapTitle("git.sessionBriefing")).toBe(REPORT_LABELS.sessionBriefing);
  });

  it("matches package.json contributes.commands titles for the three report commands", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, "package.json"), "utf-8")
    ) as { contributes: { commands: Array<{ command: string; title: string }> } };

    const pkgTitle = (cmd: string): string | undefined =>
      pkg.contributes.commands.find((c) => c.command === cmd)?.title;

    expect(pkgTitle("meridian.git.showAnalytics")).toBe(REPORT_LABELS.gitAnalytics);
    expect(pkgTitle("meridian.hygiene.showAnalytics")).toBe(REPORT_LABELS.hygieneAnalytics);
    expect(pkgTitle("meridian.git.sessionBriefing")).toBe(REPORT_LABELS.sessionBriefing);
  });
});
