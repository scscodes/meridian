/**
 * Error Code Definitions — Centralized error codes.
 * Every error code must be explicitly defined here.
 */

// ============================================================================
// Git Domain Error Codes
// ============================================================================

export const GIT_ERROR_CODES = {
  // Core Git Operations
  GIT_UNAVAILABLE: "GIT_UNAVAILABLE",
  GIT_INIT_ERROR: "GIT_INIT_ERROR",
  GIT_STATUS_ERROR: "GIT_STATUS_ERROR",
  GIT_PULL_ERROR: "GIT_PULL_ERROR",
  GIT_COMMIT_ERROR: "GIT_COMMIT_ERROR",
  GIT_FETCH_ERROR: "GIT_FETCH_ERROR",
  GIT_OPERATION_FAILED: "GIT_OPERATION_FAILED",
  GIT_POLICY_DENIED: "GIT_POLICY_DENIED",

  // Change Parsing
  GET_CHANGES_FAILED: "GET_CHANGES_FAILED",

  // Analytics
  ANALYTICS_ERROR: "ANALYTICS_ERROR",
  INVALID_PERIOD: "INVALID_PERIOD",
} as const;

// ============================================================================
// Hygiene Domain Error Codes
// ============================================================================

export const HYGIENE_ERROR_CODES = {
  HYGIENE_INIT_ERROR: "HYGIENE_INIT_ERROR",
  HYGIENE_SCAN_ERROR: "HYGIENE_SCAN_ERROR",
  HYGIENE_CLEANUP_ERROR: "HYGIENE_CLEANUP_ERROR",
  FILE_READ_ERROR: "FILE_READ_ERROR",
  FILE_DELETE_ERROR: "FILE_DELETE_ERROR",
  IMPACT_ANALYSIS_ERROR: "IMPACT_ANALYSIS_ERROR",
  HYGIENE_CLEANUP_NO_FILES: "HYGIENE_CLEANUP_NO_FILES",
  HYGIENE_ANALYTICS_ERROR: "HYGIENE_ANALYTICS_ERROR",
  DEAD_CODE_SCAN_ERROR: "DEAD_CODE_SCAN_ERROR",
} as const;

// ============================================================================
// Router Error Codes
// ============================================================================

export const ROUTER_ERROR_CODES = {
  HANDLER_NOT_FOUND: "HANDLER_NOT_FOUND",
  HANDLER_CONFLICT: "HANDLER_CONFLICT",
  HANDLER_ERROR: "HANDLER_ERROR",
  MIDDLEWARE_ERROR: "MIDDLEWARE_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  DOMAIN_INIT_ERROR: "DOMAIN_INIT_ERROR",
} as const;

// ============================================================================
// Infrastructure Error Codes
// ============================================================================

export const INFRASTRUCTURE_ERROR_CODES = {
  WORKSPACE_NOT_FOUND: "WORKSPACE_NOT_FOUND",
  WORKSPACE_READ_ERROR: "WORKSPACE_READ_ERROR",
  WORKSPACE_WRITE_ERROR: "WORKSPACE_WRITE_ERROR",
  WEBVIEW_ERROR: "WEBVIEW_ERROR",
  LOGGER_ERROR: "LOGGER_ERROR",
  MODEL_UNAVAILABLE: "MODEL_UNAVAILABLE",
  RUN_LOG_WRITE_ERROR: "RUN_LOG_WRITE_ERROR",
  RUN_LOG_READ_ERROR: "RUN_LOG_READ_ERROR",
  RUN_LOG_PARSE_ERROR: "RUN_LOG_PARSE_ERROR",
  RUN_LOG_VERSION_UNSUPPORTED: "RUN_LOG_VERSION_UNSUPPORTED",
  PULSE_WRITE_ERROR: "PULSE_WRITE_ERROR",
  PULSE_READ_ERROR: "PULSE_READ_ERROR",
  PULSE_VERSION_UNSUPPORTED: "PULSE_VERSION_UNSUPPORTED",
  RETENTION_ERROR: "RETENTION_ERROR",
} as const;

// ============================================================================
// Generic Error Codes
// ============================================================================

export const GENERIC_ERROR_CODES = {
  INVALID_PARAMS: "INVALID_PARAMS",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  TIMEOUT: "TIMEOUT",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

/**
 * Combined error codes for convenience
 */
export const ERROR_CODES = {
  ...GIT_ERROR_CODES,
  ...HYGIENE_ERROR_CODES,
  ...ROUTER_ERROR_CODES,
  ...INFRASTRUCTURE_ERROR_CODES,
  ...GENERIC_ERROR_CODES,
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
