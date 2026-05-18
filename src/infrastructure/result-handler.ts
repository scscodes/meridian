/**
 * Result → user-facing message converter.
 * Maps Result<unknown> + command name to a level + human-readable string
 * suitable for OutputChannel and vscode.window notifications.
 */

import { CommandName, Result } from "../types";

export const ERROR_MESSAGES: Partial<Record<string, string>> = {
  // Git — core
  GIT_UNAVAILABLE:           "Git is not available in this workspace.",
  GIT_INIT_ERROR:            "Git initialization failed.",
  GIT_STATUS_ERROR:          "Failed to read git status.",
  GIT_PULL_ERROR:            "Git pull failed.",
  GIT_COMMIT_ERROR:          "Commit failed.",
  GIT_FETCH_ERROR:           "Fetch failed.",
  GIT_RESET_ERROR:           "Git reset failed.",
  // Git — analytics
  ANALYTICS_ERROR:           "Git analytics generation failed.",
  EXPORT_ERROR:              "Analytics export failed.",
  INVALID_PERIOD:            "Invalid time period for analytics.",
  // Hygiene
  HYGIENE_INIT_ERROR:        "Hygiene service initialization failed.",
  HYGIENE_SCAN_ERROR:        "Workspace scan failed.",
  HYGIENE_CLEANUP_ERROR:     "Cleanup failed.",
  FILE_READ_ERROR:           "Failed to read file.",
  FILE_DELETE_ERROR:          "Failed to delete file.",
  IMPACT_ANALYSIS_ERROR:     "Impact analysis failed.",
  HYGIENE_CLEANUP_NO_FILES:  "No files matched for cleanup.",
  HYGIENE_ANALYTICS_ERROR:   "Hygiene analytics failed.",
  DEAD_CODE_SCAN_ERROR:      "Dead code scan failed.",
  // Router
  HANDLER_NOT_FOUND:         "Command not recognized.",
  HANDLER_CONFLICT:          "Duplicate handler registered for this command.",
  HANDLER_ERROR:             "Command handler threw an unexpected error.",
  MIDDLEWARE_ERROR:           "Middleware pipeline failed.",
  VALIDATION_ERROR:          "Command parameter validation failed.",
  DOMAIN_INIT_ERROR:         "Domain service initialization failed.",
  // Infrastructure
  CONFIG_INIT_ERROR:         "Configuration initialization failed.",
  CONFIG_SET_ERROR:          "Failed to update configuration.",
  CONFIG_READ_ERROR:         "Failed to read configuration.",
  CONFIG_WRITE_ERROR:        "Failed to write configuration.",
  WORKSPACE_NOT_FOUND:       "No workspace folder is open.",
  WORKSPACE_READ_ERROR:      "Failed to read workspace files.",
  WORKSPACE_WRITE_ERROR:     "Failed to write workspace files.",
  WEBVIEW_ERROR:             "Webview failed to render.",
  LOGGER_ERROR:              "Logger encountered an error.",
  MODEL_UNAVAILABLE:         "Language model is not available.",
  // Generic
  INVALID_PARAMS:            "Invalid parameters provided.",
  NOT_IMPLEMENTED:           "This feature is not yet implemented.",
  TIMEOUT:                   "Operation timed out.",
  UNKNOWN_ERROR:             "An unexpected error occurred.",
};

export interface UserMessage {
  level: "info" | "error";
  message: string;
}

export function getFriendlyErrorMessage(error: { code: string; message: string }): string {
  return ERROR_MESSAGES[error.code] ?? error.message;
}

export function formatResultMessage(
  commandName: string,
  result: Result<unknown>
): UserMessage {
  if (result.kind === "err") {
    const msg = getFriendlyErrorMessage(result.error);
    return { level: "error", message: `[${commandName}] ${msg}` };
  }

  const v = result.value as Record<string, unknown>;

  switch (commandName as CommandName) {
    case "git.status": {
      const branch = v.branch ?? "unknown";
      const dirty = v.isDirty ? "dirty" : "clean";
      return { level: "info", message: `${branch} (${dirty}) — staged: ${v.staged}, unstaged: ${v.unstaged}, untracked: ${v.untracked}` };
    }
    case "git.pull":
      return { level: "info", message: `Pulled: ${(v as { message?: string }).message ?? "up to date"}` };
    case "git.commit":
      return { level: "info", message: `Committed: ${v}` };
    case "git.sessionBriefing":
      return { level: "info", message: "Session briefing generated — see Output" };
    case "hygiene.scan": {
      const dead = ((v.deadFiles as unknown[]) ?? []).length;
      const large = ((v.largeFiles as unknown[]) ?? []).length;
      const logs = ((v.logFiles as unknown[]) ?? []).length;
      return { level: "info", message: `Scan complete — dead: ${dead}, large: ${large}, logs: ${logs}` };
    }
    case "hygiene.cleanup":
      return { level: "info", message: "Cleanup complete." };
    default:
      return { level: "info", message: `[${commandName}] OK` };
  }
}
