import { AgentExecutionResult } from "../domains/agent/types";
import { LM_TOOL_DEFS } from "./command-catalog";
import {
  CommandName,
  LmToolEnvelope,
  LmToolErrorData,
  LmToolRenderHint,
  Result,
} from "../types";
import { getFriendlyErrorMessage } from "./result-handler";

type EnvelopeBuilder = (result: Result<unknown>) => LmToolEnvelope;

function okEnvelope(
  summary: string,
  data: unknown,
  renderHint: LmToolRenderHint,
  followups: string[] = []
): LmToolEnvelope {
  return { summary, data, followups, renderHint };
}

function errEnvelope(
  commandName: CommandName,
  result: Extract<Result<unknown>, { kind: "err" }>
): LmToolEnvelope<LmToolErrorData> {
  return {
    summary: `[${commandName}] ${getFriendlyErrorMessage(result.error)}`,
    data: {
      code: result.error.code,
      message: result.error.message,
      details: result.error.details,
      context: result.error.context,
    },
    followups: ["Check logs/output for diagnostics and retry with refined input."],
    renderHint: "status",
  };
}

function fromResult(
  commandName: CommandName,
  result: Result<unknown>,
  onOk: (value: unknown) => LmToolEnvelope
): LmToolEnvelope {
  if (result.kind === "err") return errEnvelope(commandName, result);
  return onOk(result.value);
}

const LM_TOOL_ENVELOPE_BUILDERS: Partial<Record<CommandName, EnvelopeBuilder>> = {
  "git.status": (result) => fromResult("git.status", result, (value) => {
    const v = value as Record<string, unknown>;
    const branch = String(v.branch ?? "unknown");
    const dirty = v.isDirty ? "dirty" : "clean";
    return okEnvelope(
      `${branch} (${dirty}) — staged: ${v.staged ?? 0}, unstaged: ${v.unstaged ?? 0}, untracked: ${v.untracked ?? 0}`,
      value,
      "status",
      ["Run smart commit if staged changes are ready."]
    );
  }),
  "git.smartCommit": (result) => fromResult("git.smartCommit", result, (value) => {
    const v = value as { totalGroups?: number; totalFiles?: number };
    return okEnvelope(
      `Smart commit: ${v.totalGroups ?? 0} group(s), ${v.totalFiles ?? 0} file(s)`,
      value,
      "output_channel",
      ["Generate a PR summary next."]
    );
  }),
  "git.analyzeInbound": (result) => fromResult("git.analyzeInbound", result, (value) => {
    const v = value as { branch?: string; totalInbound?: number; conflicts?: unknown[] };
    return okEnvelope(
      `Inbound: ${v.totalInbound ?? 0} remote change(s) on "${v.branch ?? "unknown"}", ${v.conflicts?.length ?? 0} conflict(s)`,
      value,
      "chat_markdown",
      ["Run conflict resolution if conflicts are reported."]
    );
  }),
  "git.showAnalytics": (result) => fromResult("git.showAnalytics", result, (value) =>
    okEnvelope("Git analytics generated.", value, "webview")
  ),
  "git.generatePR": (result) => fromResult("git.generatePR", result, (value) => {
    const v = value as { branch?: string };
    return okEnvelope(
      `PR description generated for "${v.branch ?? "unknown"}".`,
      value,
      "output_channel",
      ["Review and edit the PR description before publishing."]
    );
  }),
  "git.reviewPR": (result) => fromResult("git.reviewPR", result, (value) => {
    const v = value as { branch?: string; verdict?: string; comments?: unknown[] };
    return okEnvelope(
      `PR review for "${v.branch ?? "unknown"}": ${v.verdict ?? "unknown"} — ${v.comments?.length ?? 0} comment(s)`,
      value,
      "output_channel",
      ["Generate inline comments for the PR if needed."]
    );
  }),
  "git.commentPR": (result) => fromResult("git.commentPR", result, (value) => {
    const v = value as { branch?: string; comments?: unknown[] };
    return okEnvelope(
      `${v.comments?.length ?? 0} inline comment(s) generated for "${v.branch ?? "unknown"}".`,
      value,
      "output_channel"
    );
  }),
  "git.resolveConflicts": (result) => fromResult("git.resolveConflicts", result, (value) => {
    const v = value as { perFile?: unknown[] };
    return okEnvelope(
      `Conflict resolution generated for ${v.perFile?.length ?? 0} file(s).`,
      value,
      "tree_view"
    );
  }),
  "git.sessionBriefing": (result) => fromResult("git.sessionBriefing", result, (value) =>
    okEnvelope(
      "Session briefing generated.",
      value,
      "output_channel",
      ["Use the briefing to prioritize the next task."]
    )
  ),
  "git.exportJson": (result) => fromResult("git.exportJson", result, (value) =>
    okEnvelope("Git analytics exported as JSON.", value, "status")
  ),
  "git.exportCsv": (result) => fromResult("git.exportCsv", result, (value) =>
    okEnvelope("Git analytics exported as CSV.", value, "status")
  ),
  "hygiene.scan": (result) => fromResult("hygiene.scan", result, (value) => {
    const v = value as Record<string, unknown>;
    const dead = ((v.deadFiles as unknown[]) ?? []).length;
    const large = ((v.largeFiles as unknown[]) ?? []).length;
    const logs = ((v.logFiles as unknown[]) ?? []).length;
    return okEnvelope(
      `Scan complete — dead: ${dead}, large: ${large}, logs: ${logs}`,
      value,
      "chat_markdown",
      ["Run cleanup after confirming files are safe to remove."]
    );
  }),
  "hygiene.impactAnalysis": (result) => fromResult("hygiene.impactAnalysis", result, (value) =>
    okEnvelope("Impact analysis generated.", value, "chat_markdown")
  ),
  "workflow.list": (result) => fromResult("workflow.list", result, (value) => {
    const v = value as { count?: number };
    return okEnvelope(
      `Found ${v.count ?? 0} workflow(s).`,
      value,
      "chat_markdown",
      ["Run a workflow by name when ready."]
    );
  }),
  "workflow.run": (result) => fromResult("workflow.run", result, (value) => {
    const v = value as { workflowName?: string; duration?: number; stepCount?: number };
    const dur = v.duration ? ` in ${(v.duration / 1000).toFixed(1)}s` : "";
    return okEnvelope(
      `Workflow "${v.workflowName ?? "unknown"}" — ${v.stepCount ?? "?"} step(s)${dur}`,
      value,
      "tree_view"
    );
  }),
  "agent.list": (result) => fromResult("agent.list", result, (value) => {
    const v = value as { count?: number };
    return okEnvelope(`Found ${v.count ?? 0} agent(s).`, value, "chat_markdown");
  }),
  "agent.execute": (result) => fromResult("agent.execute", result, (value) => {
    const ar = value as AgentExecutionResult;
    const what = ar.executedCommand ?? ar.executedWorkflow ?? "unknown";
    if (!ar.success) {
      return okEnvelope(
        `Agent "${ar.agentId}" ran "${what}" — failed: ${ar.error ?? "unknown error"}`,
        value,
        "status"
      );
    }
    return okEnvelope(
      `Agent "${ar.agentId}" ran "${what}" — done in ${ar.durationMs}ms`,
      value,
      "status"
    );
  }),
  "skill.overview": (result) => fromResult("skill.overview", result, (value) =>
    okEnvelope("Skill overview generated.", value, "chat_markdown")
  ),
  "skill.prReady": (result) => fromResult("skill.prReady", result, (value) =>
    okEnvelope("PR readiness skill completed.", value, "chat_markdown")
  ),
  "skill.preMerge": (result) => fromResult("skill.preMerge", result, (value) =>
    okEnvelope("Pre-merge skill completed.", value, "chat_markdown")
  ),
  "chat.delegate": (result) => fromResult("chat.delegate", result, (value) => {
    const v = value as { commandName?: string };
    return okEnvelope(
      `Delegated → ${v.commandName ?? "unknown"}`,
      value,
      "chat_markdown"
    );
  }),
};

function assertLmEnvelopeCoverage(): void {
  const mapped = new Set(Object.keys(LM_TOOL_ENVELOPE_BUILDERS));
  const missing = LM_TOOL_DEFS.map((d) => d.commandName).filter((name) => !mapped.has(name));
  if (missing.length > 0) {
    throw new Error(`Missing LM envelope mapping for command(s): ${missing.join(", ")}`);
  }
}

assertLmEnvelopeCoverage();

export function buildLmToolEnvelope(
  commandName: CommandName,
  result: Result<unknown>
): LmToolEnvelope {
  const builder = LM_TOOL_ENVELOPE_BUILDERS[commandName];
  if (!builder) {
    if (result.kind === "err") return errEnvelope(commandName, result);
    return okEnvelope(`[${commandName}] OK`, result.value, "status");
  }
  return builder(result);
}
