/**
 * Result → user-facing message converter.
 * Maps Result<unknown> + command name to a level + human-readable string
 * suitable for OutputChannel and vscode.window notifications.
 */

import { Result } from "../types";
import { CommandName } from "../types";
import { AgentExecutionResult } from "../domains/agent/types";

const ERROR_MESSAGES: Partial<Record<string, string>> = {
  // Git — core
  GIT_UNAVAILABLE:           "Git is not available in this workspace.",
  GIT_INIT_ERROR:            "Git initialization failed.",
  GIT_STATUS_ERROR:          "Failed to read git status.",
  GIT_PULL_ERROR:            "Git pull failed.",
  GIT_COMMIT_ERROR:          "Commit failed.",
  GIT_FETCH_ERROR:           "Fetch failed.",
  GIT_RESET_ERROR:           "Git reset failed.",
  // Git — changes & staging
  GET_CHANGES_FAILED:        "Failed to retrieve file changes.",
  PARSE_CHANGES_FAILED:      "Failed to parse file changes.",
  STAGE_FAILED:              "Staging files failed.",
  // Git — batch commit
  COMMIT_FAILED:             "Commit failed.",
  BATCH_COMMIT_ERROR:        "One or more commits failed.",
  ROLLBACK_FAILED:           "Rollback after failed commit could not complete.",
  // Git — inbound analysis
  INBOUND_ANALYSIS_ERROR:    "Inbound change analysis failed.",
  INBOUND_DIFF_PARSE_ERROR:  "Failed to parse inbound diff.",
  CONFLICT_DETECTION_ERROR:  "Conflict detection failed.",
  // Git — analytics
  ANALYTICS_ERROR:           "Git analytics generation failed.",
  EXPORT_ERROR:              "Analytics export failed.",
  INVALID_PERIOD:            "Invalid time period for analytics.",
  // Git — smart commit & validation
  SMART_COMMIT_ERROR:        "Smart commit failed.",
  NO_CHANGES:                "No changes to commit.",
  NO_GROUPS_APPROVED:        "No commit groups were approved.",
  COMMIT_CANCELLED:          "Smart commit cancelled.",
  // Git — PR & conflicts
  PR_GENERATION_ERROR:       "PR description generation failed.",
  PR_REVIEW_ERROR:           "PR review generation failed.",
  PR_COMMENT_ERROR:          "PR comment generation failed.",
  CONFLICT_RESOLUTION_ERROR: "Conflict resolution failed.",
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
  // Chat
  CHAT_INIT_ERROR:           "Chat initialization failed.",
  CHAT_CONTEXT_ERROR:        "Failed to gather chat context.",
  CHAT_DELEGATE_ERROR:       "Failed to delegate chat action.",
  CHAT_DELEGATE_NO_GENERATE_FN: "Language model generate function unavailable.",
  // Workflow
  WORKFLOW_INIT_ERROR:       "Workflow engine initialization failed.",
  STEP_RUNNER_NOT_AVAILABLE: "Step runner is not available.",
  WORKFLOW_EXECUTION_ERROR:  "Workflow execution encountered an error.",
  INVALID_NEXT_STEP:         "Invalid next step in workflow.",
  STEP_EXECUTION_ERROR:      "Workflow step failed.",
  STEP_TIMEOUT:              "Workflow step timed out.",
  INTERPOLATION_ERROR:       "Workflow variable interpolation failed.",
  INVALID_WORKFLOW:          "Workflow definition is invalid.",
  WORKFLOW_LIST_ERROR:       "Failed to list workflows.",
  WORKFLOW_NOT_FOUND:        "Workflow not found.",
  WORKFLOW_EXECUTION_FAILED: "Workflow execution failed.",
  WORKFLOW_RUN_ERROR:        "Failed to run workflow.",
  // Agent
  AGENT_INIT_ERROR:          "Agent registry initialization failed.",
  AGENT_LIST_ERROR:          "Failed to list agents.",
  AGENT_NOT_FOUND:           "Agent not found.",
  MISSING_CAPABILITY:        "Agent does not have the requested capability.",
  EXECUTION_FAILED:          "Agent execution failed.",
  INVALID_WORKFLOW_REFERENCE: "Agent references an invalid workflow.",
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

export function formatResultMessage(
  commandName: string,
  result: Result<unknown>
): UserMessage {
  if (result.kind === "err") {
    const msg = ERROR_MESSAGES[result.error.code] ?? result.error.message;
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
    case "git.smartCommit": {
      const sc = v as { totalGroups: number; totalFiles: number };
      return { level: "info", message: `Smart commit: ${sc.totalGroups} group(s), ${sc.totalFiles} file(s)` };
    }
    case "git.generatePR": {
      const pr = v as { branch: string };
      return { level: "info", message: `PR description generated for "${pr.branch}" — copied to clipboard` };
    }
    case "git.reviewPR": {
      const rv = v as { branch: string; verdict: string; comments?: unknown[] };
      return { level: "info", message: `PR review for "${rv.branch}": ${rv.verdict} — ${rv.comments?.length ?? 0} comment(s)` };
    }
    case "git.commentPR": {
      const cm = v as { branch: string; comments?: unknown[] };
      return { level: "info", message: `${cm.comments?.length ?? 0} inline comment(s) generated for "${cm.branch}"` };
    }
    case "git.resolveConflicts": {
      const cr = v as { perFile?: unknown[] };
      return { level: "info", message: `Conflict resolution for ${cr.perFile?.length ?? 0} file(s) — see Output` };
    }
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
    case "workflow.list":
      return { level: "info", message: `Found ${v.count ?? 0} workflow(s)` };
    case "workflow.run": {
      const r = v as { workflowName?: string; duration?: number; stepCount?: number };
      const dur = r.duration ? ` in ${(r.duration / 1000).toFixed(1)}s` : "";
      return { level: "info", message: `Workflow "${r.workflowName}" — ${r.stepCount ?? "?"} step(s)${dur}` };
    }
    case "agent.list":
      return { level: "info", message: `Found ${v.count ?? 0} agent(s)` };
    case "agent.execute": {
      const ar = v as unknown as AgentExecutionResult;
      const what = ar.executedCommand ?? ar.executedWorkflow ?? "unknown";
      if (!ar.success) {
        return { level: "error", message: `Agent "${ar.agentId}" ran "${what}" — failed: ${ar.error ?? "unknown error"}` };
      }
      return { level: "info", message: `Agent "${ar.agentId}" ran "${what}" — done in ${ar.durationMs}ms` };
    }
    case "chat.context":
      return { level: "info", message: "Chat context gathered." };
    case "chat.delegate": {
      const dr = v as { commandName?: string };
      return { level: "info", message: `Delegated → ${dr.commandName ?? "unknown"}` };
    }
    default:
      return { level: "info", message: `[${commandName}] OK` };
  }
}
