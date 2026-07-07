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

export function reportMdHeader(label: string): string {
  return `# ${label} Report`;
}

/**
 * Escape a value for a markdown table cell: pipes and backticks are escaped,
 * newlines collapsed to spaces so a multi-line commit message can never break
 * the row structure.
 */
export function mdEscape(value: string): string {
  // Single pass: it runs per table cell inside the export serializer loops.
  return value.replace(/\r?\n|[\\|`]/g, (m) => (m === "\r\n" || m === "\n" ? " " : `\\${m}`));
}
