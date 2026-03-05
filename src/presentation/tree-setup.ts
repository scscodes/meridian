/**
 * Tree Setup — register sidebar tree data providers and refresh commands.
 */

import * as vscode from "vscode";
import { Command, CommandContext, GitProvider, Logger, Result } from "../types";
import { GitTreeProvider } from "../ui/tree-providers/git-tree-provider";
import { HygieneTreeProvider } from "../ui/tree-providers/hygiene-tree-provider";
import { WorkflowTreeProvider } from "../ui/tree-providers/workflow-tree-provider";
import { AgentTreeProvider } from "../ui/tree-providers/agent-tree-provider";

export type Dispatch = (cmd: Command, ctx: CommandContext) => Promise<Result<unknown>>;

export interface TreeProviders {
  gitTree: GitTreeProvider;
  hygieneTree: HygieneTreeProvider;
  workflowTree: WorkflowTreeProvider;
  agentTree: AgentTreeProvider;
}

export function setupTreeProviders(
  context: vscode.ExtensionContext,
  gitProvider: GitProvider,
  logger: Logger,
  workspaceRoot: string,
  dispatch: Dispatch,
  cmdCtx: CommandContext
): TreeProviders {
  const gitTree      = new GitTreeProvider(gitProvider, logger, workspaceRoot);
  const hygieneTree  = new HygieneTreeProvider(dispatch, cmdCtx, logger);
  const workflowTree = new WorkflowTreeProvider(dispatch, cmdCtx, logger);
  const agentTree    = new AgentTreeProvider(dispatch, cmdCtx, logger);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("meridian.git.view",      gitTree),
    vscode.window.registerTreeDataProvider("meridian.hygiene.view",  hygieneTree),
    vscode.window.registerTreeDataProvider("meridian.workflow.view", workflowTree),
    vscode.window.registerTreeDataProvider("meridian.agent.view",    agentTree),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("meridian.git.refresh",      () => gitTree.refresh()),
    vscode.commands.registerCommand("meridian.hygiene.refresh",  () => hygieneTree.refresh()),
    vscode.commands.registerCommand("meridian.workflow.refresh", () => workflowTree.refresh()),
    vscode.commands.registerCommand("meridian.agent.refresh",    () => agentTree.refresh()),
  );

  return { gitTree, hygieneTree, workflowTree, agentTree };
}
