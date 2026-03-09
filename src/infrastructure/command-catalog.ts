/**
 * Command Catalog — single source of truth for all Meridian commands.
 *
 * Drives three consumers automatically:
 *  - KNOWN_COMMAND_NAMES  (chat.delegate classifier validation)
 *  - LM_TOOL_DEFS         (vscode.lm.registerTool registrations)
 *  - DELEGATE_CLASSIFIER  (LLM prompt command list, via buildClassifierLines())
 *
 * Adding a new command: add one entry here.
 * Excluding from LM tools: omit `lmToolName` and note why inline.
 * Excluding from classifier + KNOWN_COMMAND_NAMES: set `omitFromClassifier: true`.
 */

import { CommandName } from "../types";

export interface CatalogEntry {
  readonly commandName: CommandName;
  /** One-line description used in the DELEGATE_CLASSIFIER prompt. */
  readonly description: string;
  /** VS Code LM tool name. Undefined = intentionally excluded (see inline comment). */
  readonly lmToolName?: string;
  /** Full classifier prompt line override (e.g. for workflow.run:<name> format). */
  readonly classifierLine?: string;
  /** Excluded from classifier prompt and KNOWN_COMMAND_NAMES (meta-commands only). */
  readonly omitFromClassifier?: boolean;
}

export const COMMAND_CATALOG: readonly CatalogEntry[] = [
  // ── Git ────────────────────────────────────────────────────────────────────
  { commandName: "git.status",            lmToolName: "meridian_git_status",           description: "check branch state"                                      },
  { commandName: "git.smartCommit",       lmToolName: "meridian_git_smart_commit",      description: "group and commit staged changes"                         },
  { commandName: "git.pull",             /* destructive: excluded from LM tools */       description: "pull remote changes"                                      },
  { commandName: "git.analyzeInbound",    lmToolName: "meridian_git_analyze_inbound",   description: "analyze incoming remote changes for conflicts"             },
  { commandName: "git.showAnalytics",     lmToolName: "meridian_git_show_analytics",    description: "show git analytics report"                                },
  { commandName: "git.generatePR",        lmToolName: "meridian_git_generate_pr",       description: "generate a PR description"                                },
  { commandName: "git.reviewPR",          lmToolName: "meridian_git_review_pr",         description: "review branch changes (verdict + comments)"               },
  { commandName: "git.commentPR",         lmToolName: "meridian_git_comment_pr",        description: "generate inline review comments"                          },
  { commandName: "git.resolveConflicts",  lmToolName: "meridian_git_resolve_conflicts", description: "suggest conflict resolution strategies"                   },
  { commandName: "git.sessionBriefing",   lmToolName: "meridian_git_session_briefing",  description: "generate a morning session briefing"                      },
  { commandName: "git.exportJson",        lmToolName: "meridian_git_export_json",       description: "export git analytics data as JSON"                        },
  { commandName: "git.exportCsv",         lmToolName: "meridian_git_export_csv",        description: "export git analytics data as CSV"                         },
  // ── Hygiene ────────────────────────────────────────────────────────────────
  { commandName: "hygiene.scan",          lmToolName: "meridian_hygiene_scan",          description: "scan workspace for dead files, large files, logs"         },
  { commandName: "hygiene.showAnalytics", /* webview: excluded from LM tools */          description: "show hygiene analytics"                                   },
  { commandName: "hygiene.cleanup",       /* destructive: excluded from LM tools */      description: "delete flagged files from a hygiene scan (dry-run safe)"  },
  { commandName: "hygiene.impactAnalysis",lmToolName: "meridian_hygiene_impact",        description: "trace blast radius of a file or function"                 },
  // ── Workflow ───────────────────────────────────────────────────────────────
  { commandName: "workflow.list",         lmToolName: "meridian_workflow_list",         description: "list available workflows"                                 },
  { commandName: "workflow.run",          lmToolName: "meridian_workflow_run",          description: "run a named workflow",
    classifierLine: "workflow.run:<name>   – run a named workflow (replace <name>)" },
  // ── Agent ──────────────────────────────────────────────────────────────────
  { commandName: "agent.list",            lmToolName: "meridian_agent_list",            description: "list available agents"                                    },
  { commandName: "agent.execute",         lmToolName: "meridian_agent_execute",         description: "run a named agent with a target command or workflow"      },
  // ── Chat (meta: omitted from classifier + KNOWN_COMMAND_NAMES) ─────────────
  { commandName: "chat.context",  omitFromClassifier: true, description: "gather workspace and git context"  },
  { commandName: "chat.delegate", omitFromClassifier: true, lmToolName: "meridian_chat_delegate", description: "classify and delegate a task" },
];

/**
 * All command names the classifier may return (excludes meta chat.* commands).
 * Used by createDelegateHandler to validate LLM output.
 */
export const KNOWN_COMMAND_NAMES: ReadonlySet<string> = new Set(
  COMMAND_CATALOG
    .filter(e => !e.omitFromClassifier)
    .map(e => e.commandName)
);

/**
 * LM tool definitions derived from the catalog.
 * Filters to only entries with an explicit lmToolName.
 */
export const LM_TOOL_DEFS: readonly { name: string; commandName: CommandName }[] = COMMAND_CATALOG
  .filter((e): e is CatalogEntry & { lmToolName: string } => e.lmToolName !== undefined)
  .map(e => ({ name: e.lmToolName, commandName: e.commandName }));

/**
 * Generate the command-list lines for the DELEGATE_CLASSIFIER prompt.
 * Entries with classifierLine get their full override; others are auto-formatted.
 */
export function buildClassifierLines(): string {
  const PAD = 22;
  return COMMAND_CATALOG
    .filter(e => !e.omitFromClassifier)
    .map(e => e.classifierLine ?? `${e.commandName.padEnd(PAD)} – ${e.description}`)
    .join("\n");
}
