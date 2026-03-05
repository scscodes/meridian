/**
 * Result → user-facing message converter.
 * Maps Result<unknown> + command name to a level + human-readable string
 * suitable for OutputChannel and vscode.window notifications.
 */

import { Result } from "../types";
import { CommandName } from "../types";
import { AgentExecutionResult } from "../domains/agent/types";

const ERROR_MESSAGES: Partial<Record<string, string>> = {
  // Git
  NO_CHANGES:                "No changes to commit.",
  NO_GROUPS_APPROVED:        "No commit groups were approved.",
  COMMIT_CANCELLED:          "Smart commit cancelled.",
  GIT_UNAVAILABLE:           "Git is not available in this workspace.",
  GIT_STATUS_ERROR:          "Failed to read git status.",
  GIT_PULL_ERROR:            "Git pull failed.",
  GIT_COMMIT_ERROR:          "Commit failed.",
  GIT_FETCH_ERROR:           "Fetch failed.",
  BATCH_COMMIT_ERROR:        "One or more commits failed.",
  // Hygiene
  HYGIENE_SCAN_ERROR:        "Workspace scan failed.",
  HYGIENE_CLEANUP_ERROR:     "Cleanup failed.",
  // Router
  HANDLER_NOT_FOUND:         "Command not recognized.",
  // Workflow
  INVALID_WORKFLOW:          "Workflow definition is invalid.",
  WORKFLOW_NOT_FOUND:        "Workflow not found.",
  WORKFLOW_EXECUTION_FAILED: "Workflow execution failed.",
  WORKFLOW_RUN_ERROR:        "Failed to run workflow.",
  // Agent
  AGENT_NOT_FOUND:           "Agent not found.",
  MISSING_CAPABILITY:        "Agent does not have the requested capability.",
  EXECUTION_FAILED:          "Agent execution failed.",
  // Chat
  CHAT_CONTEXT_ERROR:        "Failed to gather chat context.",
  CHAT_DELEGATE_ERROR:       "Failed to delegate chat action.",
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
