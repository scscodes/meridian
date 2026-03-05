/**
 * Chat Participant — exposes Meridian commands via @meridian in Copilot Chat.
 *
 * Routing priority:
 *   1. request.command  — VS Code routes /slash commands here (no leading slash)
 *   2. SLASH_MAP        — explicit "/keyword" in prompt (legacy fallback)
 *   3. "run <name>"     — shorthand for workflow.run
 *   4. chat.delegate    — NL classification + dispatch via single authority
 */

import * as vscode from "vscode";
import { CommandRouter } from "../router";
import { Command, CommandContext, CommandName } from "../types";
import { Logger } from "../infrastructure/logger";
import { formatResultMessage } from "../infrastructure/result-handler";
import { GeneratedPR, GeneratedPRReview, ConflictResolutionProse } from "../domains/git/types";
import { ImpactAnalysisResult } from "../domains/hygiene/impact-analysis-handler";
import { ListWorkflowsResult } from "../domains/workflow/types";
import { ListAgentsResult, AgentExecutionResult } from "../domains/agent/types";

// Declared slash commands (mirrors package.json chatParticipants.commands[].name)
const SLASH_MAP: Record<string, CommandName> = {
  "/status":    "git.status",
  "/scan":      "hygiene.scan",
  "/workflows": "workflow.list",
  "/agents":    "agent.list",
  "/analytics": "git.showAnalytics",
  "/context":   "chat.context",
  "/pr":        "git.generatePR",
  "/review":    "git.reviewPR",
  "/briefing":  "git.sessionBriefing",
  "/conflicts": "git.resolveConflicts",
  "/impact":    "hygiene.impactAnalysis",
};

export function createChatParticipant(
  router: CommandRouter,
  ctx: CommandContext,
  logger: Logger
): vscode.Disposable {
  const handler: vscode.ChatRequestHandler = async (request, _chatCtx, stream, _token) => {
    // Debug: log incoming request shape so issues can be diagnosed
    logger.info(
      `Chat request — command: ${JSON.stringify(request.command)}, prompt: ${JSON.stringify(request.prompt)}`,
      "ChatParticipant"
    );

    // ── 1. request.command: VS Code routes /slash commands here ─────────────
    //    e.g. "@meridian /status"  →  request.command = "status"
    if (request.command) {
      const cmd = request.command.toLowerCase();
      const commandName = SLASH_MAP[`/${cmd}`];
      if (commandName) {
        logger.info(`Routing via request.command: ${cmd} → ${commandName}`, "ChatParticipant");
        stream.markdown(`\`@meridian\` → \`${commandName}\`\n\n`);
        return handleDirectDispatch(commandName, {}, router, ctx, stream, logger);
      }
    }

    const text = request.prompt.trim();
    const firstWord = text.split(" ")[0].toLowerCase();

    // ── 2. SLASH_MAP: explicit "/keyword" in prompt ──────────────────────────
    if (firstWord in SLASH_MAP) {
      const commandName = SLASH_MAP[firstWord];
      stream.markdown(`\`@meridian\` → \`${commandName}\`\n\n`);
      return handleDirectDispatch(commandName, {}, router, ctx, stream, logger);
    }

    // ── 3. "run <name>" shorthand ────────────────────────────────────────────
    if (firstWord === "run" && text.length > 4) {
      const name = text.slice(4).trim();
      stream.markdown(`\`@meridian\` → \`workflow.run\`\n\n`);
      return handleDirectDispatch("workflow.run", { name }, router, ctx, stream, logger);
    }

    // ── 4. NL → chat.delegate (single classification authority) ──────────────
    if (text.length > 0) {
      stream.progress("Figuring out what you need...");
      const delegateResult = await router.dispatch(
        { name: "chat.delegate" as CommandName, params: { task: text } },
        ctx
      );
      if (delegateResult.kind === "ok") {
        const dr = delegateResult.value as { commandName: string; result: unknown };
        stream.markdown(`\`@meridian\` → \`${dr.commandName}\`\n\n`);
        return formatCommandResult(dr.commandName as CommandName, dr.result, stream);
      } else {
        logger.warn("chat.delegate failed, falling back", "ChatParticipant", delegateResult.error);
        stream.markdown(`\`@meridian\` → \`chat.context\`\n\n`);
        return handleDirectDispatch("chat.context", {}, router, ctx, stream, logger);
      }
    }

    // ── 6. Empty prompt fallback ─────────────────────────────────────────────
    stream.markdown(`\`@meridian\` — use \`/status\`, \`/scan\`, \`/pr\`, \`/review\`, \`/briefing\`, \`/conflicts\`, \`/workflows\`, \`/agents\`, \`/analytics\`, or just describe what you need.`);
  };

  const participant = vscode.chat.createChatParticipant("meridian", handler);
  participant.iconPath = vscode.Uri.joinPath(
    vscode.Uri.file(ctx.extensionPath),
    "media",
    "icon.svg"
  );
  return participant;
}

// ── Direct dispatch (slash commands, keywords, "run <name>") ────────────────

async function handleDirectDispatch(
  commandName: CommandName,
  params: Record<string, unknown>,
  router: CommandRouter,
  ctx: CommandContext,
  stream: vscode.ChatResponseStream,
  logger: Logger
): Promise<void> {
  // Auto-populate filePath for impact analysis from active editor
  if (commandName === "hygiene.impactAnalysis" && !params.filePath) {
    if (!ctx.activeFilePath) {
      stream.markdown("Open a TypeScript file first, then try `/impact` again.");
      return;
    }
    params = { ...params, filePath: ctx.activeFilePath };
  }

  const cmd: Command = { name: commandName, params };
  const result = await router.dispatch(cmd, ctx);

  if (result.kind === "ok") {
    formatCommandResult(commandName, result.value, stream);
  } else {
    logger.warn(`Chat dispatch failed: ${commandName}`, "ChatParticipant", result.error);
    stream.markdown(`**Error** \`${result.error.code}\`: ${result.error.message}`);
  }
}

// ── Result formatting (shared by direct dispatch + chat.delegate path) ───────
// Add new formatters here — no need to touch dispatch logic.

type ResultFormatter = (value: unknown, stream: vscode.ChatResponseStream) => void;

const RESULT_FORMATTERS: Partial<Record<CommandName, ResultFormatter>> = {
  "chat.context": (value, stream) => {
    const v = value as Record<string, unknown>;
    const gitStatus = v.gitStatus as Record<string, unknown> | undefined;
    const branch = v.gitBranch ?? gitStatus?.branch ?? "unknown";
    const dirty = gitStatus?.isDirty ? "dirty" : "clean";
    const file = v.activeFile ?? "none";
    stream.markdown(
      `**Branch:** \`${branch}\` (${dirty})\n\n` +
      `**Active file:** \`${file}\`\n\n` +
      `Slash commands: \`/status\` \`/scan\` \`/pr\` \`/review\` \`/briefing\` \`/conflicts\` \`/workflows\` \`/agents\` \`/analytics\` \`/impact\`\n\n` +
      `Or ask naturally: _"show me my agents"_, _"what workflows do I have?"_, _"scan for issues"_`
    );
  },
  "git.sessionBriefing": (value, stream) => {
    stream.markdown(value as string);
  },
  "git.generatePR": (value, stream) => {
    stream.markdown((value as GeneratedPR).body);
  },
  "git.reviewPR": (value, stream) => {
    const rv = value as GeneratedPRReview;
    stream.markdown(`**Verdict:** ${rv.verdict}\n\n${rv.summary}\n\n`);
    for (const c of rv.comments ?? []) {
      stream.markdown(`- **[${c.severity}]** \`${c.file}\`: ${c.comment}\n`);
    }
  },
  "git.resolveConflicts": (value, stream) => {
    const cr = value as ConflictResolutionProse;
    stream.markdown(`${cr.overview}\n\n`);
    for (const f of cr.perFile ?? []) {
      stream.markdown(`**\`${f.path}\`** → \`${f.strategy}\`\n${f.rationale}\n`);
    }
  },
  "hygiene.impactAnalysis": (value, stream) => {
    stream.markdown((value as ImpactAnalysisResult).summary);
  },
  "workflow.list": (value, stream) => {
    const r = value as ListWorkflowsResult;
    if (r.count === 0) {
      stream.markdown("No workflows found. Add `.vscode/workflows/*.json` to your workspace.");
      return;
    }
    stream.markdown(`**${r.count} workflow${r.count === 1 ? "" : "s"} available:**\n\n`);
    for (const w of r.workflows) {
      const steps = `${w.stepCount} step${w.stepCount === 1 ? "" : "s"}`;
      stream.markdown(`- **${w.name}** (${steps})${w.description ? ` — ${w.description}` : ""}\n`);
    }
  },
  "agent.list": (value, stream) => {
    const r = value as ListAgentsResult;
    if (r.count === 0) {
      stream.markdown("No agents found. Add `.vscode/agents/*.json` to your workspace.");
      return;
    }
    stream.markdown(`**${r.count} agent${r.count === 1 ? "" : "s"} available:**\n\n`);
    for (const a of r.agents) {
      stream.markdown(`- **${a.id}**${a.description ? ` — ${a.description}` : ""} (${a.capabilities.length} capabilities)\n`);
    }
  },
  "agent.execute": (value, stream) => {
    const r = value as AgentExecutionResult;
    const what = r.executedCommand ?? r.executedWorkflow ?? "unknown";
    const status = r.success ? "succeeded" : "failed";
    stream.markdown(`**Agent \`${r.agentId}\`** ran \`${what}\` — ${status} in ${r.durationMs}ms\n\n`);
    if (r.error) {
      stream.markdown(`**Error:** ${r.error}\n\n`);
    }
    if (r.output && Object.keys(r.output).length > 0) {
      stream.markdown("**Output:**\n```json\n" + JSON.stringify(r.output, null, 2) + "\n```\n");
    }
  },
};

function formatCommandResult(
  commandName: CommandName,
  value: unknown,
  stream: vscode.ChatResponseStream,
): void {
  const formatter = RESULT_FORMATTERS[commandName];
  if (formatter) {
    formatter(value, stream);
    return;
  }
  // Default: generic message from result-handler
  const msg = formatResultMessage(commandName, { kind: "ok", value });
  stream.markdown(msg.message);
}

