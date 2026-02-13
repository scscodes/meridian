import type { ScanSummary, Severity } from '../types/index.js';

/** Characters used for random ID generation */
const ID_RADIX = 36;
const ID_SLICE_START = 2;
const ID_SLICE_END = 9;

/**
 * Generate a unique identifier for findings, scans, etc.
 * Format: `{timestamp}-{random}` — sortable by creation time.
 */
export function generateId(): string {
  return `${Date.now().toString(ID_RADIX)}-${Math.random().toString(ID_RADIX).slice(ID_SLICE_START, ID_SLICE_END)}`;
}

/**
 * Create an empty ScanSummary with zeroed counters.
 */
export function emptyScanSummary(): ScanSummary {
  return {
    totalFindings: 0,
    bySeverity: {
      error: 0,
      warning: 0,
      info: 0,
      hint: 0,
    } satisfies Record<Severity, number>,
    filesScanned: 0,
    filesWithFindings: 0,
  };
}

/**
 * Build a ScanSummary from a list of findings.
 */
export function buildScanSummary(
  findings: Array<{ severity: Severity; location: { filePath: string } }>,
  filesScanned: number,
): ScanSummary {
  const bySeverity: Record<Severity, number> = { error: 0, warning: 0, info: 0, hint: 0 };
  const filesWithFindings = new Set<string>();

  for (const f of findings) {
    bySeverity[f.severity]++;
    filesWithFindings.add(f.location.filePath);
  }

  return {
    totalFindings: findings.length,
    bySeverity,
    filesScanned,
    filesWithFindings: filesWithFindings.size,
  };
}
