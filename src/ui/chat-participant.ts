/**
 * Chat Participant — exposes Meridian commands via @meridian in Copilot Chat.
 *
 * Routing priority:
 *   1. request.command  — VS Code routes /slash commands here (no leading slash)
 *   2. SLASH_MAP        — explicit "/keyword" in prompt (legacy fallback)
 *   3. "run <name>"     — shorthand for workflow.run
 *   4. KEYWORD_MAP      — single-word natural language ("status", "agents", etc.)
 *   5. chat.delegate    — NL classification + dispatch via single authority
 */

import * as vscode from "vscode";
import { CommandRouter } from "../router";
import { Command, CommandContext, CommandName } from "../types";
import { Logger } from "../infrastructure/logger";
import { formatResultMessage } from "../infrastructure/result-handler";

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
};

// Single-word natural language keywords → direct dispatch, no LLM needed
const KEYWORD_MAP: Record<string, CommandName> = {
  "status":    "git.status",
  "scan":      "hygiene.scan",
  "hygiene":   "hygiene.scan",
  "workflows": "workflow.list",
  "workflow":  "workflow.list",
  "agents":    "agent.list",
  "agent":     "agent.list",
  "analytics": "git.showAnalytics",
  "commit":    "git.smartCommit",
  "pull":      "git.pull",
  "context":   "chat.context",
  "pr":        "git.generatePR",
  "review":    "git.reviewPR",
  "briefing":  "git.sessionBriefing",
  "session":   "git.sessionBriefing",
  "conflicts": "git.resolveConflicts",
  "resolve":   "git.resolveConflicts",
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
      const commandName = SLASH_MAP[`/${cmd}`] ?? KEYWORD_MAP[cmd];
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

    // ── 4. KEYWORD_MAP: single-word natural language ─────────────────────────
    if (firstWord in KEYWORD_MAP) {
      const commandName = KEYWORD_MAP[firstWord];
      stream.markdown(`\`@meridian\` → \`${commandName}\`\n\n`);
      return handleDirectDispatch(commandName, {}, router, ctx, stream, logger);
    }

    // ── 5. NL → chat.delegate (single classification authority) ──────────────
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

function formatCommandResult(
  commandName: CommandName,
  value: unknown,
  stream: vscode.ChatResponseStream,
): void {
  if (commandName === "chat.context") {
    const v = value as Record<string, unknown>;
    const gitStatus = v.gitStatus as Record<string, unknown> | undefined;
    const branch = v.gitBranch ?? gitStatus?.branch ?? "unknown";
    const dirty = gitStatus?.isDirty ? "dirty" : "clean";
    const file = v.activeFile ?? "none";
    stream.markdown(
      `**Branch:** \`${branch}\` (${dirty})\n\n` +
      `**Active file:** \`${file}\`\n\n` +
      `Slash commands: \`/status\` \`/scan\` \`/pr\` \`/review\` \`/briefing\` \`/conflicts\` \`/workflows\` \`/agents\` \`/analytics\`\n\n` +
      `Or ask naturally: _"show me my agents"_, _"what workflows do I have?"_, _"scan for issues"_`
    );
  } else if (commandName === "git.sessionBriefing") {
    stream.markdown(value as string);
  } else if (commandName === "git.generatePR") {
    const pr = value as any;
    stream.markdown(pr.body);
  } else if (commandName === "git.reviewPR") {
    const rv = value as any;
    stream.markdown(`**Verdict:** ${rv.verdict}\n\n${rv.summary}\n\n`);
    for (const c of rv.comments ?? []) {
      stream.markdown(`- **[${c.severity}]** \`${c.file}\`: ${c.comment}\n`);
    }
  } else if (commandName === "git.resolveConflicts") {
    const cr = value as any;
    stream.markdown(`${cr.overview}\n\n`);
    for (const f of cr.perFile ?? []) {
      stream.markdown(`**\`${f.path}\`** → \`${f.strategy}\`\n${f.rationale}\n`);
    }
  } else {
    const msg = formatResultMessage(commandName, { kind: "ok", value });
    stream.markdown(msg.message);
    if (commandName === "workflow.list" || commandName === "agent.list") {
      stream.markdown("\n\n```json\n" + JSON.stringify(value, null, 2) + "\n```");
    }
  }
}

