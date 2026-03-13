/**
 * SmartCommit Approval UI — QuickPick-based group selection and message editing.
 *
 * Two-phase flow:
 *   Phase A: Multi-select QuickPick for group selection (all picked by default)
 *   Phase B: InputBox per selected group for commit message editing
 *
 * Returns ApprovalItem[] on success, null on cancel (Escape).
 */

import * as vscode from "vscode";
import type { ChangeGroup, ApprovalUI, ApprovalItem } from "../domains/git/types";
import { UI_SETTINGS } from "../constants";

interface GroupQuickPickItem extends vscode.QuickPickItem {
  group: ChangeGroup;
}

export function createSmartCommitApprovalUI(): ApprovalUI {
  return async (groups: ChangeGroup[]): Promise<ApprovalItem[] | null> => {
    // Phase A: group selection
    const items: GroupQuickPickItem[] = groups.map((g) => ({
      label: `$(git-commit) ${g.suggestedMessage.full}`,
      description: formatGroupStats(g),
      detail: formatFilePaths(g),
      picked: true,
      group: g,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      canPickMany: true,
      title: "Smart Commit — Select groups to commit",
      placeHolder: "Toggle groups, then press Enter to confirm",
    });

    if (selected === undefined) return null; // Escape
    if (selected.length === 0) return []; // All deselected

    // Phase B: message editing
    const approved: ApprovalItem[] = [];
    for (let i = 0; i < selected.length; i++) {
      const g = selected[i].group;
      const edited = await vscode.window.showInputBox({
        title: `Commit message (${i + 1} of ${selected.length})`,
        prompt: `${g.files.length} file(s): ${formatFilePaths(g)}`,
        value: g.suggestedMessage.full,
        validateInput: (v) =>
          v.trim().length === 0 ? "Message cannot be empty" : null,
      });

      if (edited === undefined) return null; // Escape cancels everything
      approved.push({ group: g, approvedMessage: edited });
    }

    return approved;
  };
}

function formatGroupStats(g: ChangeGroup): string {
  const adds = g.files.reduce((s, f) => s + f.additions, 0);
  const dels = g.files.reduce((s, f) => s + f.deletions, 0);
  return `${g.files.length} file(s) · +${adds} -${dels}`;
}

function formatFilePaths(g: ChangeGroup): string {
  const max = UI_SETTINGS.SMART_COMMIT_MAX_FILE_PATHS;
  const paths = g.files.map((f) => f.path);
  if (paths.length <= max) return paths.join(", ");
  return `${paths.slice(0, max).join(", ")} +${paths.length - max} more`;
}
