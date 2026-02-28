/**
 * Hygiene Tree Provider — displays workspace scan results in the sidebar.
 *
 * Categories (in order):
 *   Dead Code  — unused imports/locals/type-params, grouped by file, click → exact line
 *   Dead Files — temp/backup files
 *   Large Files
 *   Log Files
 *   Markdown Files
 */

import * as vscode from "vscode";
import { Command, CommandContext, DeadCodeItem, Logger, Result, WorkspaceScan } from "../../types";

type Dispatcher = (cmd: Command, ctx: CommandContext) => Promise<Result<unknown>>;

type HygieneItemKind = "category" | "file" | "markdownFile" | "deadCodeFile" | "deadCodeIssue";

class HygieneTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly itemKind: HygieneItemKind,
    public readonly children: HygieneTreeItem[],
    collapsible: vscode.TreeItemCollapsibleState,
    description?: string,
    public readonly filePath?: string
  ) {
    super(label, collapsible);
    this.description = description;
    this.contextValue = itemKind;
  }
}

export class HygieneTreeProvider implements vscode.TreeDataProvider<HygieneTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<HygieneTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private cached: HygieneTreeItem[] | null = null;

  constructor(
    private readonly dispatch: Dispatcher,
    private readonly ctx: CommandContext,
    private readonly logger: Logger
  ) {}

  refresh(): void {
    this.cached = null;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: HygieneTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: HygieneTreeItem): Promise<HygieneTreeItem[]> {
    if (!element) {
      return this.getRootItems();
    }
    return element.children;
  }

  private async getRootItems(): Promise<HygieneTreeItem[]> {
    if (this.cached) return this.cached;

    const result = await this.dispatch({ name: "hygiene.scan", params: {} }, this.ctx);
    if (result.kind === "err") {
      this.logger.warn("HygieneTreeProvider: scan failed", "HygieneTreeProvider", result.error);
      const err = new HygieneTreeItem(
        "Scan failed",
        "category",
        [],
        vscode.TreeItemCollapsibleState.None,
        result.error.code
      );
      err.iconPath = new vscode.ThemeIcon("error");
      return [err];
    }

    const scan = result.value as WorkspaceScan;

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    const makeFileItem = (filePath: string, description?: string): HygieneTreeItem => {
      const it = new HygieneTreeItem(
        filePath.split("/").pop() ?? filePath,
        "file",
        [],
        vscode.TreeItemCollapsibleState.None,
        description ?? filePath,
        filePath
      );
      it.iconPath = new vscode.ThemeIcon("file");
      it.tooltip = filePath;
      it.command = {
        command: "vscode.open",
        title: "Open File",
        arguments: [vscode.Uri.file(filePath)],
      };
      return it;
    };

    const makeCategory = (
      label: string,
      icon: string,
      children: HygieneTreeItem[]
    ): HygieneTreeItem => {
      const it = new HygieneTreeItem(
        label,
        "category",
        children,
        children.length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
        String(children.length)
      );
      it.iconPath = new vscode.ThemeIcon(icon);
      return it;
    };

    const makeMarkdownItem = (filePath: string, sizeBytes: number, lineCount: number): HygieneTreeItem => {
      const sizeKb = (sizeBytes / 1024).toFixed(1);
      const it = new HygieneTreeItem(
        filePath.split("/").pop() ?? filePath,
        "markdownFile",
        [],
        vscode.TreeItemCollapsibleState.None,
        `${sizeKb} KB · ${lineCount} lines`,
        filePath
      );
      it.iconPath = new vscode.ThemeIcon("markdown");
      it.tooltip = filePath;
      it.command = {
        command: "vscode.open",
        title: "Open File",
        arguments: [vscode.Uri.file(filePath)],
      };
      return it;
    };

    // -------------------------------------------------------------------------
    // Dead Code — two-level: file node → issue leaf
    // -------------------------------------------------------------------------

    const deadCodeSection = this.buildDeadCodeSection(scan, makeCategory);

    // -------------------------------------------------------------------------
    // Remaining categories
    // -------------------------------------------------------------------------

    const deadItems = scan.deadFiles.map((p) => makeFileItem(p));
    const largeItems = scan.largeFiles.map((f) =>
      makeFileItem(f.path, `${(f.sizeBytes / 1024).toFixed(1)} KB`)
    );
    const logItems = scan.logFiles.map((p) => makeFileItem(p));
    const mdItems = (scan.markdownFiles ?? []).map((f) =>
      makeMarkdownItem(f.path, f.sizeBytes, f.lineCount)
    );

    this.cached = [
      deadCodeSection,
      makeCategory("Dead Files", "trash", deadItems),
      makeCategory("Large Files", "database", largeItems),
      makeCategory("Log Files", "output", logItems),
      makeCategory("Markdown Files", "markdown", mdItems),
    ];
    return this.cached;
  }

  // ---------------------------------------------------------------------------
  // Dead code tree construction
  // ---------------------------------------------------------------------------

  private buildDeadCodeSection(
    scan: WorkspaceScan,
    makeCategory: (label: string, icon: string, children: HygieneTreeItem[]) => HygieneTreeItem
  ): HygieneTreeItem {
    const { deadCode } = scan;

    // Group items by filePath, sort files alphabetically
    const groups = new Map<string, DeadCodeItem[]>();
    for (const item of deadCode.items) {
      if (!groups.has(item.filePath)) {
        groups.set(item.filePath, []);
      }
      groups.get(item.filePath)!.push(item);
    }

    const sortedPaths = [...groups.keys()].sort();

    const fileNodes = sortedPaths.map((filePath) => {
      const issues = groups.get(filePath)!;

      // Issue leaf nodes — click navigates to exact line/column
      const issueNodes: HygieneTreeItem[] = issues.map((issue) => {
        const label = `${issue.line}: ${issue.message}`;
        const it = new HygieneTreeItem(
          label,
          "deadCodeIssue",
          [],
          vscode.TreeItemCollapsibleState.None,
          undefined,
          filePath
        );
        it.iconPath = new vscode.ThemeIcon(iconForDeadCode(issue.category));
        it.tooltip = `${filePath}:${issue.line}:${issue.character} — ${issue.message}`;
        it.command = {
          command: "vscode.open",
          title: "Go to Issue",
          arguments: [
            vscode.Uri.file(filePath),
            { selection: new vscode.Range(issue.line - 1, issue.character - 1, issue.line - 1, issue.character - 1) },
          ],
        };
        return it;
      });

      // File node — collapsed, shows issue count as description
      const fileName = filePath.split("/").pop() ?? filePath;
      const fileNode = new HygieneTreeItem(
        fileName,
        "deadCodeFile",
        issueNodes,
        vscode.TreeItemCollapsibleState.Collapsed,
        `${issues.length} issue${issues.length !== 1 ? "s" : ""}`,
        filePath
      );
      fileNode.iconPath = new vscode.ThemeIcon("file-code");
      fileNode.tooltip = filePath;
      return fileNode;
    });

    const label = deadCode.tsconfigPath === null ? "Dead Code (no tsconfig)" : "Dead Code";
    return makeCategory(label, "symbol-misc", fileNodes);
  }
}

function iconForDeadCode(category: DeadCodeItem["category"]): string {
  switch (category) {
    case "unusedImport":    return "symbol-namespace";
    case "unusedTypeParam": return "symbol-type-parameter";
    default:                return "symbol-variable";
  }
}
