/**
 * Centralized, typed constants for the entire application.
 * No magic strings or numbers; all thresholds, names, and patterns are explicit.
 *
 * Organized by domain for clarity.
 */

// ============================================================================
// Cache Configuration
// ============================================================================

export const CACHE_SETTINGS = {
  /** Git analytics report cache TTL in milliseconds (10 minutes) */
  ANALYTICS_TTL_MS: 10 * 60 * 1000,

  /** Dead code scan cache TTL in milliseconds (5 minutes) */
  DEAD_CODE_TTL_MS: 5 * 60 * 1000,
} as const;

// ============================================================================
// Dotdir Layout (ADR 014)
// ============================================================================

/** Per-workspace Meridian dotdir root. */
export const MERIDIAN_DIR = ".meridian";

/** Generated-report / artifact subdir under the dotdir (self-ignored). */
export const MERIDIAN_ARTIFACTS_DIR = "artifacts";

// ============================================================================
// Workspace Exclusion Base — shared across git and hygiene analytics.
// Domain-specific lists extend via spread.
// ============================================================================

export const WORKSPACE_EXCLUDE_BASE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/.vscode/**",
  "**/.idea/**",
] as const;

// ============================================================================
// Hygiene Configuration
// ============================================================================

export const HYGIENE_SETTINGS = {
  /** Whether hygiene checks are enabled */
  ENABLED: true,

  /** Scan interval in minutes */
  SCAN_INTERVAL_MINUTES: 60,

  /**
   * Threshold above which a file is flagged as "Large" in the sidebar.
   * Matches PRUNE_DEFAULTS.maxSizeMB so the sidebar and webview prune
   * criteria stay in sync. Lowered from 10 MB (2026-05) — at 10 MB the
   * sidebar bucket was empty on realistic repos and provided no signal.
   */
  MAX_FILE_SIZE_BYTES: 1 * 1024 * 1024,

  /** File patterns to exclude from hygiene checks */
  EXCLUDE_PATTERNS: [
    ...WORKSPACE_EXCLUDE_BASE,
    // Build / output
    "**/dist/**",
    "**/build/**",
    "**/out/**",
    "**/bundled/**",
    // Python runtime & tooling
    "**/.venv/**",
    "**/venv/**",
    "**/__pycache__/**",
    "**/.pytest_cache/**",
    "**/.mypy_cache/**",
    "**/.ruff_cache/**",
    "**/.tox/**",
    "**/.eggs/**",
    "**/*.egg-info/**",
    // JS/TS coverage & caches
    "**/coverage/**",
    "**/.nyc_output/**",
    "**/.cache/**",
  ] as readonly string[],

  /** Log file patterns to detect */
  LOG_FILE_PATTERNS: ["*.log", "debug.log", "*-error.log"] as const,

  /** Temporary file patterns */
  TEMP_FILE_PATTERNS: ["*.tmp", "*.temp", "*.bak", "*~", "*.orig", "*.swp"] as const,
} as const;

// ============================================================================
// Hygiene Analytics — lighter exclusion set for the analytics scan.
// Unlike HYGIENE_SETTINGS.EXCLUDE_PATTERNS, we keep dist/, build/, out/, etc.
// so they are surfaced as prune candidates. Heavy dirs (node_modules, venv,
// __pycache__) are excluded from recursion but get a single "exists" placeholder
// so they still show in the report without scanning contents.
// ============================================================================

export const HYGIENE_ANALYTICS_EXCLUDE_PATTERNS = [
  ...WORKSPACE_EXCLUDE_BASE,
  // Python runtime & tooling
  "**/.venv/**",
  "**/venv/**",
  "**/__pycache__/**",
  "**/.pytest_cache/**",
  "**/.mypy_cache/**",
  "**/.ruff_cache/**",
  "**/.tox/**",
  "**/.eggs/**",
  "**/*.egg-info/**",
  // Package managers & build tool caches
  "**/.yarn/**",
  "**/.pnpm-store/**",
  "**/vendor/**",
  "**/vendor",
  "**/.bundle/**",
  "**/.gradle/**",
  "**/packages/**",
  "**/packages",
  "**/.terraform/**",
  "**/.terraform",
  "**/.dart_tool/**",
  "**/.dart_tool",
  "**/deps/**",
  "**/deps",
  "**/_build/**",
  "**/_build",
  "**/.stack-work/**",
  "**/.stack-work",
  "**/.cpcache/**",
  "**/.cpcache",
] as const;

// ============================================================================
// Telemetry Event Types
// ============================================================================

export const TELEMETRY_EVENT_KINDS = {
  COMMAND_STARTED: "COMMAND_STARTED",
  COMMAND_COMPLETED: "COMMAND_COMPLETED",
  COMMAND_FAILED: "COMMAND_FAILED",
} as const;

// ============================================================================
// Git Analytics Settings
// ============================================================================

export const ANALYTICS_SETTINGS = {
  /** Number of high-churn files to surface in the summary report */
  TOP_CHURN_FILES_COUNT: 10,

  /** Number of top authors to surface in the summary report */
  TOP_AUTHORS_COUNT: 5,

  /** Maximum file rows written to a CSV export */
  CSV_MAX_FILES: 100,

  /** Volatility score above which a file is classified as "high" risk */
  RISK_HIGH_VOLATILITY: 100,

  /** Volatility score above which a file is classified as "medium" risk */
  RISK_MEDIUM_VOLATILITY: 30,

  /** Confidence score assigned to commit trend calculations (0–1) */
  TREND_CONFIDENCE: 0.75,

  /** Minimum slope magnitude to classify a trend as "up" or "down" vs "stable" */
  TREND_SLOPE_THRESHOLD: 0.5,
} as const;

// ============================================================================
// Dead Code Diagnostics
// ============================================================================

/**
 * TypeScript diagnostic codes surfaced by the dead code scanner.
 * 6133 — 'X' is declared but its value is never read (unused local/param/import binding)
 * 6192 — All imports in import declaration are unused
 * 6196 — 'X' is declared but never used (unused type parameter)
 * 6198 — All destructured elements are unused
 * 6199 — All variables in destructuring declaration are unused
 * 6205 — 'X' is read but never used
 */
export const DEAD_CODE_DIAGNOSTIC_CODES = new Set([6133, 6192, 6196, 6198, 6199, 6205]);

// ============================================================================
// Session Briefing
// ============================================================================

export const SESSION_BRIEFING = {
  /** Number of most-recent run-log entries fetched for the briefing */
  RECENT_RUN_LIMIT: 10,

  /** Number of most-recent commits fetched for the briefing's git-core slice */
  RECENT_COMMIT_LIMIT: 10,

  /** Max contributors surfaced in the ActivityWindow */
  TOP_CONTRIBUTORS_LIMIT: 3,

  /** Max highest-volatility files retained in the ActivityWindow churn sample */
  CHURN_SAMPLE_LIMIT: 5,

  /**
   * Max commit-frequency series points retained in the ActivityWindow for the
   * briefing sparkline. 3mo ≈ 13 weekly points; this defensively bounds the
   * wire shape if the analytics period is widened via options (ADR 011:
   * additive ActivityWindow fields must be sample-limited via this block).
   */
  SPARKLINE_MAX_POINTS: 16,

  /** Max dead-code items retained in the HygieneSnapshot sample */
  DEAD_CODE_SAMPLE_LIMIT: 5,

  /** Analytics period passed to GitAnalyzer */
  ANALYTICS_PERIOD: "3mo" as const,

  /** Uncommitted file count above which a flag is raised */
  UNCOMMITTED_FILES_FLAG_THRESHOLD: 10,

  /** Dead-file count at or above which a hygiene flag is raised */
  DEAD_FILE_FLAG_THRESHOLD: 5,

  /** Large-file count at or above which a hygiene flag is raised */
  LARGE_FILE_FLAG_THRESHOLD: 3,

  /** Minimum number of failed runs that triggers a flag */
  FAILED_RUNS_FLAG_THRESHOLD: 1,
} as const;

// ============================================================================
// Pending-Change Risk
// ============================================================================

/**
 * Bounds for the additive `SessionBriefing.pendingChangeRisk` slice — the
 * deterministic join of the dirty-set against the already-computed analytics
 * risk model. Pure post-processing; no new I/O (ADR 011 additive-slice rule).
 */
export const PENDING_RISK = {
  /**
   * Max changed files retained in the slice after the deterministic
   * risk→volatility→path sort. The cap is applied AFTER sorting, so the
   * highest-risk files are never truncated; `capped` signals truncation and
   * the aggregate counts are computed from the full pre-cap set.
   */
  MAX_FILES: 20,

  /**
   * Number of changed files at a `high` risk tier at or above which a visible
   * "Modifying N high-risk files" flag is raised, consistent with the other
   * SESSION_BRIEFING flag thresholds.
   */
  HOTSPOT_FLAG_THRESHOLD: 3,
} as const;

// ============================================================================
// Change Coupling (co-change)
// ============================================================================

/**
 * Bounds for the deterministic co-change computation surfaced as "Change
 * Companions" in Git Analytics (`GitAnalyticsReport.coChange`). Pure
 * post-processing of the already-parsed `commits[].files`; no new I/O. A pair's
 * `count` is the number of in-window commits that touched both files (support);
 * `coChangeRate = count / min(timesA, timesB)` is the conditional co-change rate
 * of the rarer file (0–1). Not a probabilistic heuristic — plain arithmetic.
 */
export const CO_CHANGE = {
  /**
   * Commits touching more than this many files are skipped: merges and sweeping
   * renames couple everything-with-everything (coupling noise) and the pair
   * count is O(files²), so the cap also bounds compute.
   */
  MAX_COMMIT_FILES: 25,

  /** A pair must co-change in at least this many commits to surface (noise floor). */
  MIN_SUPPORT: 2,

  /** Max ranked pairs retained on the report (bounds wire/JSON payload). */
  MAX_PAIRS: 100,

  /** Pairs rendered in the Git Analytics panel (top slice of the stored list). */
  PANEL_PAIRS: 15,

  /** Max pair rows written to a CSV export. */
  CSV_MAX_PAIRS: 50,
} as const;

// ============================================================================
// Pending-Change Companions
// ============================================================================

/**
 * Bounds for the additive `SessionBriefing.pendingChangeCompanions` slice — the
 * deterministic join of the dirty-set against the already-computed analytics
 * `coChange` list. Surfaces files that historically ship with your current
 * changes but are NOT in the dirty set ("possibly forgotten"). Pure
 * post-processing; no new I/O (ADR 011 additive-slice rule).
 */
export const COMPANIONS = {
  /** A pair's co-change rate must be at least this for the untouched side to qualify. */
  MIN_CONFIDENCE: 0.4,

  /** Max companion files surfaced after the rate→count→path sort. */
  MAX_FILES: 10,

  /** Max triggering dirty files listed per companion ("ships with …"). */
  BECAUSE_OF_LIMIT: 3,

  /**
   * Number of suggested companions at or above which a visible
   * "Possibly missing N companion file(s)" flag is raised, consistent with the
   * other SESSION_BRIEFING flag thresholds.
   */
  FLAG_THRESHOLD: 2,
} as const;

// ============================================================================
// UI Settings
// ============================================================================

export const UI_SETTINGS = {
  /** Debounce delay for file watcher → tree refresh (ms) */
  WATCHER_DEBOUNCE_MS: 500,

  /** Horizontal rule character count for Output channel sections */
  OUTPUT_HR_LENGTH: 60,

  /** Max file paths shown per group in Smart Commit QuickPick before "+N more" */
  SMART_COMMIT_MAX_FILE_PATHS: 5,

  /** Max sample items per category in the hygiene scan chat formatter */
  CHAT_SCAN_MAX_HIGHLIGHTS: 3,

  /** Number of recent commits shown in the Git sidebar tree */
  GIT_TREE_RECENT_COMMITS: 3,

  /** Max commit message length in tree labels before truncation with "…" */
  TREE_COMMIT_MESSAGE_MAX_LENGTH: 50,

  /** Max untracked files listed in the Git sidebar tree */
  GIT_TREE_MAX_UNTRACKED: 15,
} as const;
