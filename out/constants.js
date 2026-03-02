"use strict";
/**
 * Centralized, typed constants for the entire application.
 * No magic strings or numbers; all thresholds, names, and patterns are explicit.
 *
 * Organized by domain for clarity.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEAD_CODE_DIAGNOSTIC_CODES = exports.ANALYTICS_SETTINGS = exports.TELEMETRY_EVENT_KINDS = exports.LOG_SETTINGS = exports.CHAT_SETTINGS = exports.HYGIENE_ANALYTICS_EXCLUDE_PATTERNS = exports.HYGIENE_SETTINGS = exports.GIT_DEFAULTS = exports.CACHE_SETTINGS = void 0;
// ============================================================================
// Cache Configuration
// ============================================================================
exports.CACHE_SETTINGS = {
    /** Git analytics report cache TTL in milliseconds (10 minutes) */
    ANALYTICS_TTL_MS: 10 * 60 * 1000,
    /** Dead code scan cache TTL in milliseconds (5 minutes) */
    DEAD_CODE_TTL_MS: 5 * 60 * 1000,
};
// ============================================================================
// Git Configuration Defaults
// ============================================================================
exports.GIT_DEFAULTS = {
    /** Default remote name */
    DEFAULT_REMOTE: "origin",
    /** Default main branch */
    DEFAULT_BRANCH: "main",
    /** Fallback branch if main doesn't exist */
    FALLBACK_BRANCH: "master",
    /** Default depth for shallow clones (0 = full clone) */
    CLONE_DEPTH: 0,
    /** Whether to auto-fetch before operations */
    AUTO_FETCH: false,
    /** Whether to clean branches after merge */
    AUTO_BRANCH_CLEAN: true,
    /** Commit message minimum length (characters) */
    MIN_MESSAGE_LENGTH: 5,
    /** Commit message maximum length (characters) */
    MAX_MESSAGE_LENGTH: 72,
    /** Maximum number of inbound changes to process */
    MAX_INBOUND_CHANGES: 100,
    /** Git operation timeout in milliseconds */
    OPERATION_TIMEOUT_MS: 30 * 1000,
};
// ============================================================================
// Hygiene Configuration
// ============================================================================
exports.HYGIENE_SETTINGS = {
    /** Whether hygiene checks are enabled */
    ENABLED: true,
    /** Scan interval in minutes */
    SCAN_INTERVAL_MINUTES: 60,
    /** Maximum file size to check in bytes (10 MB) */
    MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
    /** File patterns to exclude from hygiene checks */
    EXCLUDE_PATTERNS: [
        // VCS + editor
        "**/node_modules/**",
        "**/.git/**",
        "**/.vscode/**",
        "**/.idea/**",
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
    ],
    /** Log file patterns to detect */
    LOG_FILE_PATTERNS: ["*.log", "debug.log", "*-error.log"],
    /** Temporary file patterns */
    TEMP_FILE_PATTERNS: ["*.tmp", "*.temp", "*.bak", "*~", "*.orig", "*.swp"],
};
// ============================================================================
// Hygiene Analytics — lighter exclusion set for the analytics scan.
// Unlike HYGIENE_SETTINGS.EXCLUDE_PATTERNS, we keep dist/, build/, out/, etc.
// so they are surfaced as prune candidates. Heavy dirs (node_modules, venv,
// __pycache__) are excluded from recursion but get a single "exists" placeholder
// so they still show in the report without scanning contents.
// ============================================================================
exports.HYGIENE_ANALYTICS_EXCLUDE_PATTERNS = [
    "**/node_modules/**",
    "**/.git/**",
    "**/.vscode/**",
    "**/.idea/**",
    "**/.venv/**",
    "**/venv/**",
    "**/__pycache__/**",
    "**/.pytest_cache/**",
    "**/.mypy_cache/**",
    "**/.ruff_cache/**",
    "**/.tox/**",
    "**/.eggs/**",
    "**/*.egg-info/**",
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
];
// ============================================================================
// Chat Configuration
// ============================================================================
exports.CHAT_SETTINGS = {
    /** Default LLM model for chat operations */
    DEFAULT_MODEL: "gpt-4",
    /** Alternative models */
    AVAILABLE_MODELS: ["gpt-4", "gpt-3.5-turbo", "gpt-4-turbo"],
    /** Lines of context to include from active file */
    CONTEXT_LINES: 50,
    /** Maximum context size in characters */
    MAX_CONTEXT_CHARS: 4000,
    /** Chat message timeout in milliseconds */
    RESPONSE_TIMEOUT_MS: 30 * 1000,
    /** Maximum number of messages to keep in conversation */
    MAX_CONVERSATION_DEPTH: 10,
};
// ============================================================================
// Logging Configuration
// ============================================================================
exports.LOG_SETTINGS = {
    /** Default log level */
    DEFAULT_LEVEL: "info",
    /** Available log levels */
    LEVELS: ["debug", "info", "warn", "error"],
    /** Maximum entries per log level */
    MAX_ENTRIES_PER_LEVEL: 250,
    /** Whether to include timestamps in logs */
    INCLUDE_TIMESTAMPS: true,
    /** Whether to include context in logs */
    INCLUDE_CONTEXT: true,
};
// ============================================================================
// Telemetry Event Types
// ============================================================================
exports.TELEMETRY_EVENT_KINDS = {
    COMMAND_STARTED: "COMMAND_STARTED",
    COMMAND_COMPLETED: "COMMAND_COMPLETED",
    COMMAND_FAILED: "COMMAND_FAILED",
    CACHE_HIT: "CACHE_HIT",
    CACHE_MISS: "CACHE_MISS",
    ERROR_OCCURRED: "ERROR_OCCURRED",
    WORKFLOW_STARTED: "WORKFLOW_STARTED",
    WORKFLOW_COMPLETED: "WORKFLOW_COMPLETED",
    WORKFLOW_FAILED: "WORKFLOW_FAILED",
    AGENT_INVOKED: "AGENT_INVOKED",
    USER_ACTION: "USER_ACTION",
};
// ============================================================================
// Git Analytics Settings
// ============================================================================
exports.ANALYTICS_SETTINGS = {
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
    /**
     * Divisor used to normalize each trend half-period to a per-week rate.
     * NOTE: Currently a fixed estimate. See docs/TODO.md for the known limitation
     * (does not account for actual period length — tracked for future fix).
     */
    TREND_NORMALIZE_WEEKS: 4,
};
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
exports.DEAD_CODE_DIAGNOSTIC_CODES = new Set([6133, 6192, 6196, 6198, 6199, 6205]);
//# sourceMappingURL=constants.js.map