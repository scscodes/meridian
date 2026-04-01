/**
 * Command Registry — maps VS Code command IDs to internal CommandNames
 * and registers them with the dispatch + presentation pipeline.
 */

import * as vscode from "vscode";
import { CommandRouter } from "../router";
import { CommandName, Command, CommandContext } from "../types";
import { formatResultMessage } from "../infrastructure/result-handler";
import { PruneConfig } from "../domains/hygiene/analytics-types";
import { presentResult, PresenterContext } from "./result-presenters";

/** Commands that show a progress notification during dispatch. */
const PROGRESS_COMMANDS: ReadonlySet<CommandName> = new Set([
  "git.generatePR", "git.reviewPR", "git.sessionBriefing",
  "git.showAnalytics", "hygiene.scan",
] as CommandName[]);

const PROGRESS_TITLES: Partial<Record<CommandName, string>> = {
  "git.generatePR": "Generating PR description...",
  "git.reviewPR": "Reviewing branch changes...",
  "git.sessionBriefing": "Generating session briefing...",
  "git.showAnalytics": "Loading git analytics...",
  "hygiene.scan": "Scanning workspace...",
};

/**
 * Presentation-layer command metadata.
 * Mirrors the role of CatalogEntry in command-catalog.ts, but for the VS Code surface:
 * maps VS Code command IDs to internal CommandNames with display metadata.
 *
 * title undefined    = internal command (not declared in contributes.commands)
 * showInPalette true = appears in commandPalette (requires title)
 * requiresGit true   = commandPalette entry also gates on gitOpenRepositoryCount > 0
 */
export interface CommandMapEntry {
  readonly vsCodeId: string;
  readonly commandName: CommandName;
  /** Display title for contributes.commands. Undefined = internal/LM-tool-only, not manifest-declared. */
  readonly title?: string;
  readonly icon?: string;
  /** Expose in commandPalette. Only meaningful when title is defined. */
  readonly showInPalette?: boolean;
  /** commandPalette entry also requires gitOpenRepositoryCount > 0 */
  readonly requiresGit?: boolean;
}

/** VS Code command ID → internal CommandName + display metadata */
export const COMMAND_MAP: ReadonlyArray<CommandMapEntry> = [
  // ── Git ─────────────────────────────────────────────────────────────────────
  { vsCodeId: "meridian.git.status",            commandName: "git.status",           title: "Git: Show Status",               showInPalette: true,  requiresGit: true  },
  { vsCodeId: "meridian.git.pull",              commandName: "git.pull",             title: "Git: Pull",                      showInPalette: true,  requiresGit: true  },
  { vsCodeId: "meridian.git.commit",            commandName: "git.commit",           title: "Git: Commit",                    showInPalette: true,  requiresGit: true  },
  { vsCodeId: "meridian.git.smartCommit",       commandName: "git.smartCommit",      title: "Git: Smart Commit (Interactive)", showInPalette: true,  requiresGit: true,  icon: "$(git-commit)" },
  { vsCodeId: "meridian.git.analyzeInbound",    commandName: "git.analyzeInbound"    /* LM tool only — not manifest-declared */                                        },
  { vsCodeId: "meridian.git.showAnalytics",     commandName: "git.showAnalytics",    title: "Git: Show Analytics",            showInPalette: true,  requiresGit: true,  icon: "$(graph)" },
  { vsCodeId: "meridian.git.exportJson",        commandName: "git.exportJson",       title: "Git: Export Analytics JSON",     showInPalette: true,  requiresGit: true  },
  { vsCodeId: "meridian.git.exportCsv",         commandName: "git.exportCsv",        title: "Git: Export Analytics CSV",      showInPalette: true,  requiresGit: true  },
  { vsCodeId: "meridian.git.generatePR",        commandName: "git.generatePR",       title: "Git: Generate PR Description",   showInPalette: true,  requiresGit: true  },
  { vsCodeId: "meridian.git.reviewPR",          commandName: "git.reviewPR",         title: "Git: Review PR (AI)",            showInPalette: true,  requiresGit: true  },
  { vsCodeId: "meridian.git.commentPR",         commandName: "git.commentPR",        title: "Git: Generate PR Comments",      showInPalette: true,  requiresGit: true  },
  { vsCodeId: "meridian.git.sessionBriefing",   commandName: "git.sessionBriefing",  title: "Git: Session Briefing (AI)",     showInPalette: true,  requiresGit: true,  icon: "$(notebook)" },
  // git.resolveConflicts — dedicated registration in specialized-commands.ts (tree expansion hooks)
  // ── Hygiene ──────────────────────────────────────────────────────────────────
  { vsCodeId: "meridian.hygiene.scan",          commandName: "hygiene.scan",         title: "Hygiene: Scan Workspace",        showInPalette: true  },
  { vsCodeId: "meridian.hygiene.cleanup",       commandName: "hygiene.cleanup",      title: "Hygiene: Cleanup",               showInPalette: true  },
  { vsCodeId: "meridian.hygiene.showAnalytics", commandName: "hygiene.showAnalytics",title: "Hygiene: Show Analytics",        showInPalette: true,                     icon: "$(graph)" },
  // hygiene.impactAnalysis — dedicated registration per ADR 005 (active-file fallback + function name prompt)
  // ── Chat ─────────────────────────────────────────────────────────────────────
  { vsCodeId: "meridian.chat.context",          commandName: "chat.context",         title: "Chat: Get Context",              showInPalette: true  },
  { vsCodeId: "meridian.chat.delegate",         commandName: "chat.delegate"         /* LM tool only — not manifest-declared */                                        },
  // ── Workflow ──────────────────────────────────────────────────────────────────
  { vsCodeId: "meridian.workflow.list",         commandName: "workflow.list",        title: "Workflow: List All",             showInPalette: true  },
  // ── Agent ─────────────────────────────────────────────────────────────────────
  { vsCodeId: "meridian.agent.list",            commandName: "agent.list",           title: "Agent: List All",                showInPalette: true  },
  { vsCodeId: "meridian.agent.execute",         commandName: "agent.execute"         /* LM tool only — not manifest-declared */                                        },
];

/**
 * Register all COMMAND_MAP entries as VS Code commands.
 * Hygiene.showAnalytics injects user prune config before dispatching.
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  router: CommandRouter,
  outputChannel: vscode.OutputChannel,
  getCommandContext: () => CommandContext,
  readPruneConfig: () => PruneConfig,
  presenterCtx: PresenterContext
): void {
  for (const { vsCodeId, commandName } of COMMAND_MAP) {
    const disposable = vscode.commands.registerCommand(
      vsCodeId,
      async (params: Record<string, unknown> = {}) => {
        const cmdCtx = getCommandContext();

        // hygiene.showAnalytics: inject user prune config before dispatching
        if (commandName === "hygiene.showAnalytics") {
          const pruneResult = await router.dispatch(
            { name: "hygiene.showAnalytics", params: readPruneConfig() },
            cmdCtx
          );
          await presentResult(commandName, pruneResult, presenterCtx);
          if (pruneResult.kind !== "ok") {
            const { message } = formatResultMessage(commandName, pruneResult);
            outputChannel.show(true);
            vscode.window.showErrorMessage(message, "Show Output")
              .then(choice => { if (choice === "Show Output") outputChannel.show(true); });
          }
          return;
        }

        const command: Command = { name: commandName, params };
        const doDispatch = () => router.dispatch(command, cmdCtx);
        const result = PROGRESS_COMMANDS.has(commandName)
          ? await vscode.window.withProgress(
              { location: vscode.ProgressLocation.Notification, title: PROGRESS_TITLES[commandName] ?? "Working...", cancellable: false },
              doDispatch
            )
          : await doDispatch();

        const handled = await presentResult(commandName, result, presenterCtx);
        if (handled) return;

        const { level, message } = formatResultMessage(commandName, result);
        outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
        if (level === "info") {
          vscode.window.showInformationMessage(message);
        } else {
          outputChannel.show(true);
          vscode.window.showErrorMessage(message, "Show Output")
            .then(choice => { if (choice === "Show Output") outputChannel.show(true); });
        }
      }
    );
    context.subscriptions.push(disposable);
  }
}
