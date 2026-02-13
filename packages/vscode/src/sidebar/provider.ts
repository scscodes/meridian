import * as vscode from 'vscode';
import { TOOL_REGISTRY } from '@aidev/core';
import type { ToolRegistryEntry } from '@aidev/core';

// ─── Tools Tree ─────────────────────────────────────────────────────────────

/** Icon mapping for tool IDs — keeps icon choices centralized */
const TOOL_ICONS: Record<string, string> = {
  'dead-code': 'search',
  'lint': 'checklist',
  'comments': 'comment',
  'commit': 'git-commit',
  'tldr': 'book',
};

/**
 * Tree data provider for the "Tools" view in the AIDev sidebar.
 * Renders one clickable item per registered tool.
 */
export class ToolsTreeProvider implements vscode.TreeDataProvider<ToolTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ToolTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  getTreeItem(element: ToolTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ToolTreeItem[] {
    return TOOL_REGISTRY.map(
      (entry) =>
        new ToolTreeItem(entry, TOOL_ICONS[entry.id] ?? 'beaker'),
    );
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}

class ToolTreeItem extends vscode.TreeItem {
  constructor(entry: ToolRegistryEntry, iconId: string) {
    super(entry.name, vscode.TreeItemCollapsibleState.None);
    this.tooltip = entry.description;
    this.command = {
      command: entry.commandId,
      title: entry.name,
    };
    this.iconPath = new vscode.ThemeIcon(iconId);
  }
}

// ─── Results Tree ───────────────────────────────────────────────────────────

/**
 * Tree data provider for the "Results" view in the AIDev sidebar.
 * Populated after a scan completes. Supports jump-to-source.
 */
export class ResultsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // TODO: Accept ScanResult and render findings as tree items with jump-to-source

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.TreeItem[] {
    // Placeholder — no results yet
    const placeholder = new vscode.TreeItem('No results yet — run a scan.');
    placeholder.iconPath = new vscode.ThemeIcon('info');
    return [placeholder];
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}

// ─── Registration ───────────────────────────────────────────────────────────

export function registerSidebar(_context: vscode.ExtensionContext): vscode.Disposable[] {
  const toolsProvider = new ToolsTreeProvider();
  const resultsProvider = new ResultsTreeProvider();

  return [
    vscode.window.registerTreeDataProvider('aidev.toolsView', toolsProvider),
    vscode.window.registerTreeDataProvider('aidev.resultsView', resultsProvider),
  ];
}
