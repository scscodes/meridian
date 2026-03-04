/**
 * Centralized, typed constants for the entire application.
 * No magic strings or numbers; all thresholds, names, and patterns are explicit.
 *
 * Organized by domain for clarity.
 */
export declare const CACHE_SETTINGS: {
    /** Git analytics report cache TTL in milliseconds (10 minutes) */
    readonly ANALYTICS_TTL_MS: number;
    /** Dead code scan cache TTL in milliseconds (5 minutes) */
    readonly DEAD_CODE_TTL_MS: number;
};
export declare const GIT_DEFAULTS: {
    /** Default remote name */
    readonly DEFAULT_REMOTE: "origin";
    /** Default main branch */
    readonly DEFAULT_BRANCH: "main";
    /** Fallback branch if main doesn't exist */
    readonly FALLBACK_BRANCH: "master";
    /** Default depth for shallow clones (0 = full clone) */
    readonly CLONE_DEPTH: 0;
    /** Whether to auto-fetch before operations */
    readonly AUTO_FETCH: false;
    /** Whether to clean branches after merge */
    readonly AUTO_BRANCH_CLEAN: true;
    /** Commit message minimum length (characters) */
    readonly MIN_MESSAGE_LENGTH: 5;
    /** Commit message maximum length (characters) */
    readonly MAX_MESSAGE_LENGTH: 72;
    /** Maximum number of inbound changes to process */
    readonly MAX_INBOUND_CHANGES: 100;
    /** Git operation timeout in milliseconds */
    readonly OPERATION_TIMEOUT_MS: number;
};
export declare const HYGIENE_SETTINGS: {
    /** Whether hygiene checks are enabled */
    readonly ENABLED: true;
    /** Scan interval in minutes */
    readonly SCAN_INTERVAL_MINUTES: 60;
    /** Maximum file size to check in bytes (10 MB) */
    readonly MAX_FILE_SIZE_BYTES: number;
    /** File patterns to exclude from hygiene checks */
    readonly EXCLUDE_PATTERNS: readonly ["**/node_modules/**", "**/.git/**", "**/.vscode/**", "**/.idea/**", "**/dist/**", "**/build/**", "**/out/**", "**/bundled/**", "**/.venv/**", "**/venv/**", "**/__pycache__/**", "**/.pytest_cache/**", "**/.mypy_cache/**", "**/.ruff_cache/**", "**/.tox/**", "**/.eggs/**", "**/*.egg-info/**", "**/coverage/**", "**/.nyc_output/**", "**/.cache/**"];
    /** Log file patterns to detect */
    readonly LOG_FILE_PATTERNS: readonly ["*.log", "debug.log", "*-error.log"];
    /** Temporary file patterns */
    readonly TEMP_FILE_PATTERNS: readonly ["*.tmp", "*.temp", "*.bak", "*~", "*.orig", "*.swp"];
};
export declare const HYGIENE_ANALYTICS_EXCLUDE_PATTERNS: readonly ["**/node_modules/**", "**/.git/**", "**/.vscode/**", "**/.idea/**", "**/.venv/**", "**/venv/**", "**/__pycache__/**", "**/.pytest_cache/**", "**/.mypy_cache/**", "**/.ruff_cache/**", "**/.tox/**", "**/.eggs/**", "**/*.egg-info/**", "**/.yarn/**", "**/.pnpm-store/**", "**/vendor/**", "**/vendor", "**/.bundle/**", "**/.gradle/**", "**/packages/**", "**/packages", "**/.terraform/**", "**/.terraform", "**/.dart_tool/**", "**/.dart_tool", "**/deps/**", "**/deps", "**/_build/**", "**/_build", "**/.stack-work/**", "**/.stack-work", "**/.cpcache/**", "**/.cpcache"];
export declare const CHAT_SETTINGS: {
    /** Default LLM model for chat operations */
    readonly DEFAULT_MODEL: "gpt-4";
    /** Alternative models */
    readonly AVAILABLE_MODELS: readonly ["gpt-4", "gpt-3.5-turbo", "gpt-4-turbo"];
    /** Lines of context to include from active file */
    readonly CONTEXT_LINES: 50;
    /** Maximum context size in characters */
    readonly MAX_CONTEXT_CHARS: 4000;
    /** Chat message timeout in milliseconds */
    readonly RESPONSE_TIMEOUT_MS: number;
    /** Maximum number of messages to keep in conversation */
    readonly MAX_CONVERSATION_DEPTH: 10;
};
export declare const LOG_SETTINGS: {
    /** Default log level */
    readonly DEFAULT_LEVEL: "info";
    /** Available log levels */
    readonly LEVELS: readonly ["debug", "info", "warn", "error"];
    /** Maximum entries per log level */
    readonly MAX_ENTRIES_PER_LEVEL: 250;
    /** Whether to include timestamps in logs */
    readonly INCLUDE_TIMESTAMPS: true;
    /** Whether to include context in logs */
    readonly INCLUDE_CONTEXT: true;
};
export declare const TELEMETRY_EVENT_KINDS: {
    readonly COMMAND_STARTED: "COMMAND_STARTED";
    readonly COMMAND_COMPLETED: "COMMAND_COMPLETED";
    readonly COMMAND_FAILED: "COMMAND_FAILED";
    readonly CACHE_HIT: "CACHE_HIT";
    readonly CACHE_MISS: "CACHE_MISS";
    readonly ERROR_OCCURRED: "ERROR_OCCURRED";
    readonly WORKFLOW_STARTED: "WORKFLOW_STARTED";
    readonly WORKFLOW_COMPLETED: "WORKFLOW_COMPLETED";
    readonly WORKFLOW_FAILED: "WORKFLOW_FAILED";
    readonly AGENT_INVOKED: "AGENT_INVOKED";
    readonly USER_ACTION: "USER_ACTION";
};
export declare const ANALYTICS_SETTINGS: {
    /** Number of high-churn files to surface in the summary report */
    readonly TOP_CHURN_FILES_COUNT: 10;
    /** Number of top authors to surface in the summary report */
    readonly TOP_AUTHORS_COUNT: 5;
    /** Maximum file rows written to a CSV export */
    readonly CSV_MAX_FILES: 100;
    /** Volatility score above which a file is classified as "high" risk */
    readonly RISK_HIGH_VOLATILITY: 100;
    /** Volatility score above which a file is classified as "medium" risk */
    readonly RISK_MEDIUM_VOLATILITY: 30;
    /** Confidence score assigned to commit trend calculations (0–1) */
    readonly TREND_CONFIDENCE: 0.75;
    /** Minimum slope magnitude to classify a trend as "up" or "down" vs "stable" */
    readonly TREND_SLOPE_THRESHOLD: 0.5;
};
/**
 * TypeScript diagnostic codes surfaced by the dead code scanner.
 * 6133 — 'X' is declared but its value is never read (unused local/param/import binding)
 * 6192 — All imports in import declaration are unused
 * 6196 — 'X' is declared but never used (unused type parameter)
 * 6198 — All destructured elements are unused
 * 6199 — All variables in destructuring declaration are unused
 * 6205 — 'X' is read but never used
 */
export declare const DEAD_CODE_DIAGNOSTIC_CODES: Set<number>;
export declare const UI_SETTINGS: {
    /** Debounce delay for file watcher → tree refresh (ms) */
    readonly WATCHER_DEBOUNCE_MS: 500;
};
//# sourceMappingURL=constants.d.ts.map