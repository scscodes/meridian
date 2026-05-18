/**
 * Git Tree Provider — displays branch state and change counts in the sidebar.
 * Files within each change group are expandable and open on click.
 */

import * as path from "path";
import * as vscode from "vscode";
import { GitProvider, GitStatus, RecentCommit, Logger } from "../../types";
import { UI_SETTINGS } from "../../constants";

type GitItemKind = "branch" | "changeGroup" | "changedFile" | "commit" | "report";

class GitTreeItem extends vscode.TreeItem {
  filePath?: string;
  category?: string;

  constructor(
    label: string,
    public readonly itemKind: GitItemKind,
    collapsible: vscode.TreeItemCollapsibleState,
    description?: string
  ) {
    super(label, collapsible);
    this.description = description;
    this.contextValue = itemKind;
  }
}

type TreeElement = GitTreeItem;

export class GitTreeProvider implements vscode.TreeDataProvider<TreeElement> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeElement | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private cached: GitStatus | null = null;

  constructor(
    private readonly gitProvider: GitProvider,
    private readonly logger: Logger,
    private readonly workspaceRoot: string
  ) {}

  refresh(): void {
    this.cached = null;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeElement): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeElement): Promise<TreeElement[]> {
    if (!element)                                                    return this.getRootItems();
    if ((element as GitTreeItem).itemKind === "branch")              return this.getBranchChildren();
    if ((element as GitTreeItem).itemKind === "changeGroup")         return this.getFilesForGroup(element as GitTreeItem);
    return [];
  }

  private async getRootItems(): Promise<TreeElement[]> {
    if (!this.cached) {
      const result = await this.gitProvider.status();
      if (result.kind === "err") {
        this.logger.warn("GitTreeProvider: status failed", "GitTreeProvider", result.error);
        const err = new GitTreeItem(
          "Git unavailable",
          "changeGroup",
          vscode.TreeItemCollapsibleState.None,
          result.error.code
        );
        err.iconPath = new vscode.ThemeIcon("error");
        return [err];
      }
      this.cached = result.value;
    }

    const reportItem = new GitTreeItem(
      "View Git Report",
      "report",
      vscode.TreeItemCollapsibleState.None
    );
    reportItem.iconPath = new vscode.ThemeIcon("graph");
    reportItem.tooltip = "Open the Git Analytics report";
    reportItem.command = {
      command: "meridian.git.showAnalytics",
      title: "View Git Report",
    };

    const s = this.cached;
    const dirty = s.isDirty ? "dirty" : "clean";
    const branchItem = new GitTreeItem(
      s.branch,
      "branch",
      vscode.TreeItemCollapsibleState.Expanded,
      dirty
    );
    branchItem.iconPath = new vscode.ThemeIcon(s.isDirty ? "git-branch" : "check");

    return [reportItem, branchItem];
  }

  private async getBranchChildren(): Promise<GitTreeItem[]> {
    const changeGroups = this.getChangeGroupItems();
    const commitsGroup = await this.getRecentCommitsGroup();
    return [...changeGroups, commitsGroup];
  }

  private getChangeGroupItems(): GitTreeItem[] {
    if (!this.cached) return [];
    const s = this.cached;
    const make = (label: string, count: number, icon: string, category: string) => {
      const it = new GitTreeItem(label, "changeGroup",
        count > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        String(count));
      it.iconPath = new vscode.ThemeIcon(icon);
      it.category = category;
      return it;
    };
    return [
      make("Staged",    s.staged,    "diff-added",    "staged"),
      make("Unstaged",  s.unstaged,  "diff-modified", "unstaged"),
      make("Untracked", s.untracked, "question",      "untracked"),
    ];
  }

  private async getRecentCommitsGroup(): Promise<GitTreeItem> {
    const result = await this.gitProvider.getRecentCommits(UI_SETTINGS.GIT_TREE_RECENT_COMMITS);
    const commits: RecentCommit[] = result.kind === "ok" ? result.value : [];

    const group = new GitTreeItem(
      "Recent Commits",
      "changeGroup",
      commits.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
      String(commits.length)
    );
    group.iconPath = new vscode.ThemeIcon("history");
    group.category = "recentCommits";

    // Pre-build children so getFilesForGroup can return them immediately
    (group as any).__commits = commits;
    return group;
  }

  private async getUntrackedFileItems(): Promise<GitTreeItem[]> {
    const result = await this.gitProvider.getUntrackedFiles();
    if (result.kind === "err") {
      this.logger.warn("GitTreeProvider: getUntrackedFiles failed", "GitTreeProvider", result.error);
      return [];
    }

    const cap = UI_SETTINGS.GIT_TREE_MAX_UNTRACKED;
    const files = result.value;
    const items = files.slice(0, cap).map(f => {
      const absolutePath = path.join(this.workspaceRoot, f);
      const it = new GitTreeItem(
        path.basename(f),
        "changedFile",
        vscode.TreeItemCollapsibleState.None,
        f
      );
      it.iconPath = new vscode.ThemeIcon("question");
      it.filePath = absolutePath;
      it.command = {
        command: "vscode.open",
        title: "Open File",
        arguments: [vscode.Uri.file(absolutePath)],
      };
      return it;
    });

    if (files.length > cap) {
      const overflow = new GitTreeItem(
        `+${files.length - cap} more`,
        "changedFile",
        vscode.TreeItemCollapsibleState.None
      );
      overflow.iconPath = new vscode.ThemeIcon("ellipsis");
      items.push(overflow);
    }

    return items;
  }

  private async getFilesForGroup(group: GitTreeItem): Promise<GitTreeItem[]> {
    if (group.category === "recentCommits") {
      const commits: RecentCommit[] = (group as any).__commits ?? [];
      return commits.map(c => {
        const max = UI_SETTINGS.TREE_COMMIT_MESSAGE_MAX_LENGTH;
        const label = c.message.length > max ? `${c.message.slice(0, max - 3)}…` : c.message;
        const it = new GitTreeItem(
          label,
          "commit",
          vscode.TreeItemCollapsibleState.None,
          `+${c.insertions}/-${c.deletions} · ${c.shortHash}`
        );
        it.iconPath = new vscode.ThemeIcon("git-commit");
        it.tooltip = `${c.shortHash} by ${c.author}\n+${c.insertions} / -${c.deletions}`;
        return it;
      });
    }

    if (group.category === "untracked") {
      return this.getUntrackedFileItems();
    }

    const result = await this.gitProvider.getAllChanges();
    if (result.kind === "err") {
      this.logger.warn("GitTreeProvider: getAllChanges failed", "GitTreeProvider", result.error);
      return [];
    }

    const files = result.value.filter(f =>
      group.category === "staged" ? f.status === "A" : f.status !== "A"
    );

    return files.map(f => {
      const absolutePath = path.join(this.workspaceRoot, f.path);
      const iconName =
        f.status === "A" ? "diff-added" :
        f.status === "D" ? "diff-removed" :
        "diff-modified";

      const it = new GitTreeItem(
        path.basename(f.path),
        "changedFile",
        vscode.TreeItemCollapsibleState.None,
        f.path
      );
      it.iconPath = new vscode.ThemeIcon(iconName);
      it.filePath = absolutePath;
      it.command = {
        command: "vscode.open",
        title: "Open File",
        arguments: [vscode.Uri.file(absolutePath)],
      };
      return it;
    });
  }
}
