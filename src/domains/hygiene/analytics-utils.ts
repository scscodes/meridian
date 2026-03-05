/**
 * Hygiene Analytics Pure Functions — stateless helpers extracted from analytics-service.ts.
 *
 * All functions here are pure (no FS, no side effects) and independently testable.
 */

import {
  FileCategory,
  HygieneFileEntry,
  PruneConfig,
  TemporalBucket,
  TemporalData,
} from "./analytics-types";

// ============================================================================
// Category mapping
// ============================================================================

const MARKDOWN_EXTS  = new Set([".md", ".mdx"]);
const LOG_EXTS       = new Set([".log"]);
const CONFIG_EXTS    = new Set([".yml", ".yaml", ".json", ".toml", ".ini", ".env"]);
const BACKUP_EXTS    = new Set([".bak", ".orig", ".swp"]);
const TEMP_EXTS      = new Set([".tmp", ".temp"]);
const SOURCE_EXTS    = new Set([".ts", ".js", ".py", ".go", ".rs", ".java", ".rb", ".cs", ".tsx", ".jsx", ".sh", ".bash"]);
/** Compiled / generated artifact extensions */
export const ARTIFACT_EXTS  = new Set([".class", ".pyc", ".pyo", ".o", ".obj", ".a", ".so"]);
/** Directory names that indicate build / cache, venvs, or tool output */
export const ARTIFACT_DIRS = new Set([
  "target", ".next", ".nuxt", ".parcel-cache",
  "__pycache__", "venv", ".venv",
  ".pytest_cache", ".mypy_cache", ".ruff_cache", ".tox", ".eggs",
]);

/** Extensions for which we attempt line counting (text-based only) */
export const LINE_COUNT_EXTS = new Set([
  ...MARKDOWN_EXTS, ...LOG_EXTS, ...CONFIG_EXTS, ...SOURCE_EXTS,
]);

/** Skip line counting for files over 5 MB to avoid blocking */
export const MAX_LINECOUNT_BYTES = 5 * 1024 * 1024;

/**
 * Categorize a file by extension and relative path.
 * Artifact check runs first so that, e.g., a .js file inside a target/ dir
 * is classified as artifact rather than source.
 */
export function categorize(ext: string, name: string, relPath: string): FileCategory {
  if (ARTIFACT_EXTS.has(ext)) return "artifact";
  const parts = relPath.split(/[/\\]/);
  if (parts.some((p) => ARTIFACT_DIRS.has(p) || p.endsWith(".egg-info"))) return "artifact";
  if (MARKDOWN_EXTS.has(ext))                   return "markdown";
  if (LOG_EXTS.has(ext))                        return "log";
  if (CONFIG_EXTS.has(ext))                     return "config";
  if (BACKUP_EXTS.has(ext) || name.endsWith("~")) return "backup";
  if (TEMP_EXTS.has(ext))                       return "temp";
  if (SOURCE_EXTS.has(ext))                     return "source";
  return "other";
}

/**
 * Determine whether a file's extension supports line counting and whether
 * its size is below the threshold. Returns true if countable.
 */
export function isLineCountable(ext: string, sizeBytes: number): boolean {
  return LINE_COUNT_EXTS.has(ext) && sizeBytes <= MAX_LINECOUNT_BYTES;
}

export function isPruneCandidate(
  ageDays: number,
  category: FileCategory,
  sizeBytes: number,
  lineCount: number,
  config: PruneConfig
): boolean {
  if (ageDays < config.minAgeDays) return false;
  const categoryMatch = config.categories.includes(category);
  const sizeMatch     = sizeBytes > config.maxSizeMB * 1_048_576;
  const lineMatch     = config.minLineCount > 0 && lineCount >= config.minLineCount;
  return categoryMatch || sizeMatch || lineMatch;
}

// ============================================================================
// Temporal bucketing — 14 daily buckets
// ============================================================================

interface DayInfo {
  key:   string; // ISO date "2025-01-06"
  label: string; // display label "Jan 6"
  start: number; // ms since epoch (day 00:00 local)
  end:   number; // ms since epoch (next day 00:00 local, exclusive)
}

/** Return the last N calendar days, oldest first. */
export function lastNDays(n: number): DayInfo[] {
  const result: DayInfo[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = n - 1; i >= 0; i--) {
    const dayStart = new Date(today);
    dayStart.setDate(today.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);

    const key   = dayStart.toISOString().slice(0, 10);
    const label = dayStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    result.push({ key, label, start: dayStart.getTime(), end: dayEnd.getTime() });
  }
  return result;
}

export function buildTemporalData(
  files: HygieneFileEntry[],
  deadCodeByRelPath?: Map<string, number>
): TemporalData {
  const days = lastNDays(14);
  const totalByDay:    Record<string, number>                = {};
  const pruneByDay:    Record<string, number>                = {};
  const deadCodeByDay: Record<string, number>                = {};
  const extByDay:      Record<string, Record<string, number>> = {};
  const extTotals:     Record<string, number>                = {};

  for (const d of days) {
    totalByDay[d.key]    = 0;
    pruneByDay[d.key]    = 0;
    deadCodeByDay[d.key] = 0;
    extByDay[d.key]      = {};
  }

  for (const f of files) {
    const fileMs = f.lastModified.getTime();
    for (const d of days) {
      if (fileMs >= d.start && fileMs < d.end) {
        totalByDay[d.key]++;
        if (f.isPruneCandidate) pruneByDay[d.key]++;
        if (deadCodeByRelPath) {
          deadCodeByDay[d.key] += deadCodeByRelPath.get(f.path) ?? 0;
        }
        const ext = f.extension || "(none)";
        extTotals[ext]        = (extTotals[ext] || 0) + 1;
        extByDay[d.key][ext]  = (extByDay[d.key][ext] || 0) + 1;
        break;
      }
    }
  }

  const topExtensions = Object.entries(extTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([ext]) => ext);

  const buckets: TemporalBucket[] = days.map((d) => ({
    label:         d.label,
    total:         totalByDay[d.key],
    pruneCount:    pruneByDay[d.key],
    deadCodeCount: deadCodeByDay[d.key],
    byExtension: Object.fromEntries(
      topExtensions.map((ext) => [ext, extByDay[d.key][ext] || 0])
    ),
  }));

  return { buckets, topExtensions };
}
