/**
 * Hygiene Tree Provider — displays workspace scan results in the sidebar.
 *
 * Categories (in order):
 *   Dead Code     — unused imports/locals/type-params, grouped by file, click → exact line
 *   Dead Files    — temp/backup files
 *   Large Files   — files exceeding HYGIENE_SETTINGS.MAX_FILE_SIZE_BYTES (1 MB)
 *   Log Files
 *   Markdown Files
 *   Envs / Caches / Build Outputs / Vendored Deps — heavy-artifact dir buckets
 *     (parity with the Hygiene Analytics webview Collections section)
 */

import * as vscode from "vscode";
import { Command, CommandContext, DeadCodeItem, Logger, Result, WorkspaceScan } from "../../types";
import { ImpactAnalysisResult } from "../../domains/hygiene/impact-analysis-handler";
import { StorageStatus } from "../../infrastructure/retention";

type Dispatcher = (cmd: Command, ctx: CommandContext) => Promise<Result<unknown>>;

type HygieneItemKind =
  | "category" | "file" | "markdownFile" | "deadCodeFile" | "deadCodeIssue"
  | "impactCategory" | "impactTarget" | "impactMetricGroup" | "impactFile"
  | "collectionDir" | "report"
  | "storageSection" | "storageInfo";

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

  private cachedScan: WorkspaceScan | null = null;
  private cachedItems: HygieneTreeItem[] | null = null;
  private lastImpactResult: ImpactAnalysisResult | null = null;
  private busy = false;
  private generation = 0;

  constructor(
    private readonly dispatch: Dispatcher,
    private readonly ctx: CommandContext,
    private readonly logger: Logger
  ) {}

  refresh(): void {
    const myGen = ++this.generation;
    this.busy = true;
    this.cachedScan = null;
    this.cachedItems = null;
    this._onDidChangeTreeData.fire();
    void this.prefetchRoots(myGen);
  }

  private async prefetchRoots(gen: number): Promise<void> {
    let result: Awaited<ReturnType<Dispatcher>> | undefined;
    try {
      result = await this.dispatch({ name: "hygiene.scan", params: {} }, this.ctx);
    } catch (e) {
      this.logger.warn(`HygieneTreeProvider: scan threw — ${e instanceof Error ? e.message : String(e)}`, "HygieneTreeProvider");
    }
    if (gen !== this.generation) return;
    if (result?.kind === "ok") this.cachedScan = result.value as WorkspaceScan;
    this.busy = false;
    this._onDidChangeTreeData.fire();
  }

  private getPlaceholder(): HygieneTreeItem {
    const it = new HygieneTreeItem("Refreshing…", "category", [], vscode.TreeItemCollapsibleState.None);
    it.iconPath = new vscode.ThemeIcon("loading~spin");
    it.contextValue = "loading";
    return it;
  }

  /** Store last impact analysis result for tree expansion. */
  setImpactResult(result: ImpactAnalysisResult | null): void {
    this.lastImpactResult = result;
    this.cachedItems = null;
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
    if (this.busy) return [this.getPlaceholder()];
    if (this.cachedItems) return this.cachedItems;

    if (!this.cachedScan) {
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
      this.cachedScan = result.value as WorkspaceScan;
    }

    const scan = this.cachedScan;

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

    // Collections — sidebar parity with the webview Collections section
    const workspaceRoot = this.ctx.workspaceFolders?.[0] ?? "";
    const makeCollectionItems = (paths: string[]): HygieneTreeItem[] =>
      paths.map((relPath) => {
        const absPath = workspaceRoot ? `${workspaceRoot}/${relPath}` : relPath;
        const it = new HygieneTreeItem(
          relPath.split("/").pop() ?? relPath,
          "collectionDir",
          [],
          vscode.TreeItemCollapsibleState.None,
          relPath,
          absPath
        );
        it.iconPath = new vscode.ThemeIcon("folder");
        it.tooltip = absPath;
        it.command = {
          command: "revealInExplorer",
          title: "Reveal in Explorer",
          arguments: [vscode.Uri.file(absPath)],
        };
        return it;
      });

    // Meridian Storage — self-policing surface (ADR 019). Fail-soft: on any
    // handler error (or a dispatcher that doesn't serve the command, as in
    // sparse test doubles) the section is omitted rather than blocking the tree.
    let storageSection: HygieneTreeItem | undefined;
    try {
      const storageResult = await this.dispatch(
        { name: "hygiene.storageStatus", params: {} },
        this.ctx
      );
      if (storageResult?.kind === "ok") {
        storageSection = this.buildStorageSection(storageResult.value as StorageStatus);
      } else if (storageResult?.kind === "err") {
        this.logger.warn(
          "HygieneTreeProvider: storage status failed",
          "HygieneTreeProvider",
          storageResult.error
        );
      }
    } catch {
      // Omit the section; the scan categories still render.
    }

    const items: HygieneTreeItem[] = [];
    if (this.lastImpactResult) {
      items.push(this.buildImpactSection());
    }
    if (storageSection) {
      items.push(storageSection);
    }
    items.push(
      deadCodeSection,
      makeCategory("Dead Files", "trash", deadItems),
      makeCategory("Large Files", "database", largeItems),
      makeCategory("Log Files", "output", logItems),
      makeCategory("Markdown Files", "markdown", mdItems),
      makeCategory("Envs",          "package",  makeCollectionItems(scan.collections.envs)),
      makeCategory("Caches",        "archive",  makeCollectionItems(scan.collections.caches)),
      makeCategory("Build Outputs", "tools",    makeCollectionItems(scan.collections.buildOutputs)),
      makeCategory("Vendored Deps", "library",  makeCollectionItems(scan.collections.vendoredDeps)),
    );
    this.cachedItems = items;
    return this.cachedItems;
  }

  /**
   * "Meridian Storage" section — footprint of Meridian-owned storage plus the
   * would-prune preview under the current retention policy. The section node
   * carries contextValue "storageSection" for the Prune Now menu action.
   */
  private buildStorageSection(status: StorageStatus): HygieneTreeItem {
    const mb = (bytes: number): string => (bytes / (1024 * 1024)).toFixed(2);
    const kb = (bytes: number): string => (bytes / 1024).toFixed(1);

    const rows: HygieneTreeItem[] = [];

    const a = status.artifacts;
    const oldest =
      a.oldestMtimeMs !== null
        ? ` · oldest ${Math.floor((Date.now() - a.oldestMtimeMs) / 86_400_000)}d`
        : "";
    const prunable = a.wouldPruneCount > 0 ? ` · ${a.wouldPruneCount} prunable` : "";
    const artifactsRow = new HygieneTreeItem(
      "Exported Reports",
      "storageInfo",
      [],
      vscode.TreeItemCollapsibleState.None,
      `${a.fileCount} files · ${mb(a.totalBytes)} MB${oldest}${prunable}`
    );
    artifactsRow.iconPath = new vscode.ThemeIcon("files");
    artifactsRow.tooltip =
      `.meridian/artifacts/ — ${a.fileCount} files, ${mb(a.totalBytes)} MB.` +
      (a.wouldPruneCount > 0
        ? ` Current policy would prune ${a.wouldPruneCount} file(s) (${mb(a.wouldPruneBytes)} MB).`
        : " Nothing prunable under the current policy.");
    rows.push(artifactsRow);

    const overCap =
      status.policy.runLogMaxEvents > 0
        ? Math.max(0, status.runLog.lineCount - status.policy.runLogMaxEvents)
        : 0;
    const runLogRow = new HygieneTreeItem(
      "Run Log",
      "storageInfo",
      [],
      vscode.TreeItemCollapsibleState.None,
      `${status.runLog.lineCount} events · ${kb(status.runLog.sizeBytes)} KB` +
        (overCap > 0 ? ` · ${overCap} over cap` : "")
    );
    runLogRow.iconPath = new vscode.ThemeIcon("output");
    runLogRow.tooltip = ".vscode/meridian/run-log.v1.jsonl — compacted per retention settings.";
    rows.push(runLogRow);

    const pulseRow = new HygieneTreeItem(
      "Pulse History",
      "storageInfo",
      [],
      vscode.TreeItemCollapsibleState.None,
      `${status.pulse.snapshotCount}/${status.pulse.maxSnapshots} snapshots · ${kb(status.pulse.sizeBytes)} KB`
    );
    pulseRow.iconPath = new vscode.ThemeIcon("pulse");
    pulseRow.tooltip = ".meridian/pulse/ — self-capping; no action needed.";
    rows.push(pulseRow);

    const section = new HygieneTreeItem(
      "Meridian Storage",
      "storageSection",
      rows,
      vscode.TreeItemCollapsibleState.Collapsed,
      a.wouldPruneCount > 0 ? `${a.wouldPruneCount} prunable` : undefined
    );
    section.iconPath = new vscode.ThemeIcon("server");
    section.tooltip = "Meridian-owned storage (self-policing, ADR 019)";
    return section;
  }

  private buildImpactSection(): HygieneTreeItem {
    const r = this.lastImpactResult!;
    const m = r.metrics;
    const targetLabel = r.targetFunction
      ? `${r.targetFunction}()`
      : (r.targetPath?.split("/").pop() ?? "unknown");

    const makeFileItems = (paths: string[]): HygieneTreeItem[] =>
      paths.map(p => {
        const label = p.split("/").pop() ?? p;
        const it = new HygieneTreeItem(label, "impactFile", [], vscode.TreeItemCollapsibleState.None, p, p);
        it.iconPath = new vscode.ThemeIcon("file");
        it.tooltip = p;
        it.command = { command: "vscode.open", title: "Open File", arguments: [vscode.Uri.file(p)] };
        return it;
      });

    const makeGroup = (label: string, count: number, paths: string[]): HygieneTreeItem => {
      const children = makeFileItems(paths);
      const it = new HygieneTreeItem(
        label,
        "impactMetricGroup",
        children,
        children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        String(count)
      );
      it.iconPath = new vscode.ThemeIcon("symbol-reference");
      return it;
    };

    const groups = [
      makeGroup("Importers", m.importers, m.importerPaths ?? []),
      makeGroup("Call Sites", m.callSites, m.callSitePaths ?? []),
      makeGroup("Test Files", m.testFiles, m.testFilePaths ?? []),
      makeGroup("Dependent Files", m.dependentFiles, m.dependentFilePaths ?? []),
    ];

    const targetNode = new HygieneTreeItem(
      targetLabel,
      "impactTarget",
      groups,
      vscode.TreeItemCollapsibleState.Expanded,
      r.targetPath
    );
    targetNode.iconPath = new vscode.ThemeIcon("symbol-method");

    const section = new HygieneTreeItem(
      "Impact Analysis",
      "impactCategory",
      [targetNode],
      vscode.TreeItemCollapsibleState.Expanded
    );
    section.iconPath = new vscode.ThemeIcon("search");
    return section;
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
