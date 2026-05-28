/**
 * Hygiene Analytics Pure Functions — stateless helpers extracted from analytics-service.ts.
 *
 * All functions here are pure (no FS, no side effects) and independently testable.
 */

import {
  CollectionsBreakdown,
  DuplicateBasenameEntry,
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
// Collections — heavy-artifact dir buckets surfaced as cleanup targets
// ============================================================================

export type CollectionBucket = keyof CollectionsBreakdown;

const COLLECTION_BUCKET_KEYS: readonly CollectionBucket[] = [
  "envs", "caches", "buildOutputs", "vendoredDeps",
];

/**
 * Dir-name → bucket map for the Collections section. Broader than
 * HEAVY_ARTIFACT_DIRS in analytics-service.ts: includes build-output dirs
 * (dist/build/out/target) that the walker DOES recurse into, so they get
 * surfaced as collections via their file paths, not via a placeholder row.
 */
export const COLLECTION_BUCKETS: Record<CollectionBucket, ReadonlySet<string>> = {
  envs: new Set(["venv", ".venv", "env"]),
  caches: new Set([
    "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache", ".tox", ".eggs",
    ".yarn", ".pnpm-store", ".cache",
    ".gradle", ".terraform", ".dart_tool", ".cpcache", ".stack-work", ".parcel-cache",
    ".next", ".nuxt",
  ]),
  buildOutputs: new Set([
    "dist", "build", "out", "target", "_build", "deps", "bundled",
  ]),
  vendoredDeps: new Set([
    "node_modules", "vendor", "packages", ".bundle",
  ]),
};

/** Resolve a directory name to its Collections bucket, or null if it's not a known heavy-artifact dir. */
export function bucketForDirName(name: string): CollectionBucket | null {
  for (const bucket of COLLECTION_BUCKET_KEYS) {
    if (COLLECTION_BUCKETS[bucket].has(name)) return bucket;
  }
  return null;
}

/**
 * Bucket the heavy-artifact dirs present in the workspace into named groups.
 *
 * Walks each file's path segments outermost-first; the first segment that
 * matches a known dir name claims the file for that bucket (so a `dist/`
 * inside `node_modules/` reports under vendoredDeps, not buildOutputs).
 * The bucket's `string[]` is the deduplicated set of dir paths found.
 */
export function buildCollections(files: HygieneFileEntry[]): CollectionsBreakdown {
  const seen: Record<CollectionBucket, Set<string>> = {
    envs: new Set(),
    caches: new Set(),
    buildOutputs: new Set(),
    vendoredDeps: new Set(),
  };

  for (const f of files) {
    const segments = f.path.split(/[/\\]/);
    for (let i = 0; i < segments.length; i++) {
      const bucket = bucketForDirName(segments[i]);
      if (bucket) {
        seen[bucket].add(segments.slice(0, i + 1).join("/"));
        break;
      }
    }
  }

  return {
    envs:         [...seen.envs].sort(),
    caches:       [...seen.caches].sort(),
    buildOutputs: [...seen.buildOutputs].sort(),
    vendoredDeps: [...seen.vendoredDeps].sort(),
  };
}

// ============================================================================
// Duplicate basenames — files sharing the same filename across the tree
// ============================================================================

/**
 * Group files by basename and return groups meeting the minimum-occurrences
 * threshold (default 3 — 2 fires on every routine `index.ts` pairing).
 * Placeholder rows (lineCount === -1 && sizeBytes === 0) are excluded since
 * they represent directories, not real files.
 */
export function findDuplicateBasenames(
  files: HygieneFileEntry[],
  minOccurrences: number = 3
): DuplicateBasenameEntry[] {
  const groups = new Map<string, string[]>();
  for (const f of files) {
    if (f.lineCount === -1 && f.sizeBytes === 0) continue;
    const existing = groups.get(f.name) ?? [];
    existing.push(f.path);
    groups.set(f.name, existing);
  }
  const result: DuplicateBasenameEntry[] = [];
  for (const [basename, paths] of groups) {
    if (paths.length >= minOccurrences) {
      result.push({ basename, count: paths.length, paths: [...paths].sort() });
    }
  }
  return result.sort((a, b) => (b.count - a.count) || a.basename.localeCompare(b.basename));
}

// ============================================================================
// Lines-by-category aggregate
// ============================================================================

/**
 * Sum lineCount per FileCategory. Skips rows with lineCount <= 0 (binaries,
 * unreadable files, placeholders). This is a raw line count, not the LOC
 * metric — blanks and comments are included. UI labels should say so.
 */
export function sumLinesByCategory(
  files: HygieneFileEntry[]
): Partial<Record<FileCategory, number>> {
  const out: Partial<Record<FileCategory, number>> = {};
  for (const f of files) {
    if (f.lineCount <= 0) continue;
    out[f.category] = (out[f.category] ?? 0) + f.lineCount;
  }
  return out;
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
