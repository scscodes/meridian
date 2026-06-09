/** Canonical display names for the three webview report panels. */
export const REPORT_LABELS = {
  sessionBriefing: "Session Briefing",
  gitAnalytics: "Git Analytics",
  hygieneAnalytics: "Hygiene Analytics",
} as const;

export type ReportLabelKey = keyof typeof REPORT_LABELS;

export function reportCsvHeader(label: string): string {
  return `${label} Report`;
}
