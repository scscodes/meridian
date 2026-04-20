/**
 * Dispatch signaling — subscribes to router lifecycle events and
 * drives tree-provider spinner/result state. Centralizes wiring so
 * every dispatch path (direct, chat-delegated, LM-tool) surfaces a
 * spinner without touching call sites.
 *
 * See ADR 008 (router dispatch lifecycle events) and ADR 007
 * (workflow tree step expansion) for rationale.
 */

import { CommandRouter } from "../router";
import {
  Disposable,
  DispatchCompleteEvent,
  DispatchEvent,
  Logger,
} from "../types";
import { WorkflowTreeProvider } from "../ui/tree-providers/workflow-tree-provider";
import { GitTreeProvider } from "../ui/tree-providers/git-tree-provider";
import { RunWorkflowResult } from "../domains/workflow/types";
import { ConflictResolutionProse } from "../domains/git/types";

export interface DispatchSignalingTrees {
  workflowTree: WorkflowTreeProvider;
  gitTree: GitTreeProvider;
}

export function registerDispatchSignaling(
  router: CommandRouter,
  trees: DispatchSignalingTrees,
  logger: Logger
): Disposable[] {
  const { workflowTree, gitTree } = trees;

  const beforeSub = router.onBeforeHandler((event: DispatchEvent) => {
    const { command } = event;
    if (command.name === "workflow.run") {
      const params = command.params as { name?: string };
      if (typeof params.name === "string" && params.name) {
        workflowTree.setRunning(params.name);
      }
    } else if (command.name === "git.resolveConflicts") {
      gitTree.setConflictRunning();
    }
  });

  const afterSub = router.onAfterHandler((event: DispatchCompleteEvent) => {
    const { command, result } = event;
    if (command.name === "workflow.run") {
      const params = command.params as { name?: string };
      if (typeof params.name !== "string" || !params.name) return;
      const r =
        result.kind === "ok" ? (result.value as RunWorkflowResult) : null;
      workflowTree.setLastRun(
        params.name,
        r?.success ?? false,
        r?.duration ?? 0,
        r?.stepResults ?? []
      );
    } else if (command.name === "git.resolveConflicts") {
      gitTree.setLastConflictRun(
        result.kind === "ok" ? (result.value as ConflictResolutionProse) : null
      );
    }
  });

  logger.debug(
    "Dispatch signaling registered (workflow.run, git.resolveConflicts)",
    "registerDispatchSignaling"
  );

  return [beforeSub, afterSub];
}
