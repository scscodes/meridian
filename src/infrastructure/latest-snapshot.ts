/**
 * Agent-readable "latest report" snapshots (ADR 020).
 *
 * Pure Node module — no `vscode` import, so it stays unit-testable in
 * isolation (mirrors retention.ts / jsonl-tail.ts style). Every report
 * webview's `updateReport()` fire-and-forgets a write here after each
 * render (initial open, refresh, or filter change) so
 * `.meridian/latest/<kind>.v1.json` always reflects the last-rendered
 * report — a stable, versioned, file-shaped contract that coding agents
 * (Cursor/Copilot/CLI) can read directly off disk without any runtime
 * integration or LM-tool surface.
 *
 * Every failure path warns and returns; this must never throw or block a
 * render.
 */

import * as fs from "fs";
import * as path from "path";
import { Logger } from "../types";
import { MERIDIAN_DIR, MERIDIAN_LATEST_DIR, LATEST_SNAPSHOT_FILES } from "../constants";

export type LatestSnapshotKind = keyof typeof LATEST_SNAPSHOT_FILES;

export const LATEST_SNAPSHOT_SCHEMA_VERSION = 1;

interface LatestSnapshotEnvelope {
  schemaVersion: typeof LATEST_SNAPSHOT_SCHEMA_VERSION;
  kind: LatestSnapshotKind;
  generatedAt: string;
  report: unknown;
}

const AGENTS_MD_FILENAME = "AGENTS.md";

const AGENTS_MD_CONTENT = `# Meridian agent-readable state

This directory's parent, \`.meridian/\`, contains \`latest/\` — a stable,
versioned snapshot of Meridian's computed reports for coding agents to read
directly off disk. No runtime integration or tool call is required.

## Files

- \`latest/session-briefing.v1.json\`
- \`latest/git-analytics.v1.json\`
- \`latest/hygiene-analytics.v1.json\`

Each file is a JSON envelope:

\`\`\`json
{ "schemaVersion": 1, "kind": "sessionBriefing", "generatedAt": "<ISO 8601>", "report": { ... } }
\`\`\`

## Semantics

- **Latest = last rendered.** Each file is overwritten in place whenever the
  corresponding report webview renders (initial open, refresh, or filter).
  There is no history — read history via \`.meridian/pulse/\` instead.
- **Absent optional fields mean "not measured," never zero.** Do not treat a
  missing field as a zero value.
- **Local-only.** Everything under \`.meridian/latest/\` is gitignored; it
  never leaves this machine.

## Paste into your agent rules

> Before planning work in this repo, read
> \`.meridian/latest/session-briefing.v1.json\` if present for current branch
> state, risk hotspots, and hygiene status.
`;

/** Duplicated from BaseWebviewProvider.reportToJson — that module imports vscode. */
function reportToJson(envelope: LatestSnapshotEnvelope): string {
  return JSON.stringify(envelope, (_key, value) => {
    if (value instanceof Date) return value.toISOString();
    return value;
  }, 2);
}

function latestDirPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, MERIDIAN_DIR, MERIDIAN_LATEST_DIR);
}

/**
 * Idempotently drop the self-ignoring `.gitignore` (`*`) into the latest dir
 * so snapshots never enter git. Never clobbers a user edit.
 */
function writeLatestGitignore(latestDir: string): void {
  const gitignore = path.join(latestDir, ".gitignore");
  if (!fs.existsSync(gitignore)) fs.writeFileSync(gitignore, "*\n", "utf-8");
}

/**
 * Create-if-missing `.meridian/AGENTS.md`. Never overwrites — the user may
 * have edited it.
 */
function writeAgentsMdIfMissing(workspaceRoot: string): void {
  const agentsMdPath = path.join(workspaceRoot, MERIDIAN_DIR, AGENTS_MD_FILENAME);
  if (!fs.existsSync(agentsMdPath)) fs.writeFileSync(agentsMdPath, AGENTS_MD_CONTENT, "utf-8");
}

/**
 * Write `report` to `.meridian/latest/<kind>.v1.json`, atomically (tmp +
 * rename) so a concurrent reader never observes torn JSON. Fire-and-forget
 * from a render path: every failure is logged via `logger.warn` and
 * swallowed, never thrown.
 */
export async function writeLatestSnapshot(
  workspaceRoot: string,
  kind: LatestSnapshotKind,
  report: unknown,
  logger: Logger
): Promise<void> {
  const latestDir = latestDirPath(workspaceRoot);
  const fileName = LATEST_SNAPSHOT_FILES[kind];
  const target = path.join(latestDir, fileName);
  const tmpTarget = `${target}.tmp`;

  try {
    fs.mkdirSync(latestDir, { recursive: true });
    writeLatestGitignore(latestDir);
    writeAgentsMdIfMissing(workspaceRoot);

    const envelope: LatestSnapshotEnvelope = {
      schemaVersion: LATEST_SNAPSHOT_SCHEMA_VERSION,
      kind,
      generatedAt: new Date().toISOString(),
      report,
    };

    fs.writeFileSync(tmpTarget, reportToJson(envelope), "utf-8");
    fs.renameSync(tmpTarget, target);
  } catch (e) {
    try {
      if (fs.existsSync(tmpTarget)) fs.unlinkSync(tmpTarget);
    } catch {
      // Best-effort cleanup only — nothing further to do on double failure.
    }
    logger.warn(`Latest-snapshot write failed for ${kind}: ${String(e)}`, "writeLatestSnapshot");
  }
}
