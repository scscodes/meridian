import * as vscode from 'vscode';
import { TOOL_REGISTRY, VALID_MODES } from '@aidev/core';
import type { ToolId, ExportFormat } from '@aidev/core';
import type { SettingsManager } from '../settings/index.js';
import type { ToolRunner } from '../tools/runner.js';

/**
 * Register all extension commands.
 *
 * Tool commands are driven by TOOL_REGISTRY — adding a new tool there
 * automatically registers its command here and routes to ToolRunner.
 */
export function registerCommands(
  _context: vscode.ExtensionContext,
  settings: SettingsManager,
  toolRunner: ToolRunner,
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  // Register a command for each tool in the registry
  for (const tool of TOOL_REGISTRY) {
    disposables.push(
      vscode.commands.registerCommand(tool.commandId, async () => {
        await toolRunner.run(tool.id as ToolId);
      }),
    );
  }

  // Export results command
  disposables.push(
    vscode.commands.registerCommand('aidev.exportResults', async () => {
      const results = toolRunner.getAllResults();
      if (results.size === 0) {
        void vscode.window.showInformationMessage('AIDev: No results to export. Run a scan first.');
        return;
      }

      // Pick which tool's results to export
      const toolPick = await vscode.window.showQuickPick(
        Array.from(results.entries()).map(([id, result]) => {
          const entry = TOOL_REGISTRY.find((t) => t.id === id);
          return {
            label: entry?.name ?? id,
            description: `${String(result.summary.totalFindings)} findings`,
            toolId: id,
          };
        }),
        { placeHolder: 'Which results to export?' },
      );

      if (!toolPick) return;

      const formatPick = await vscode.window.showQuickPick(
        [
          { label: 'JSON', description: 'Machine-readable format', format: 'json' as ExportFormat },
          {
            label: 'Markdown',
            description: 'Human-readable format',
            format: 'markdown' as ExportFormat,
          },
        ],
        { placeHolder: 'Export format' },
      );

      if (!formatPick) return;

      // Create and open the exported file
      const result = results.get(toolPick.toolId as ToolId);
      if (!result) return;

      const ext = formatPick.format === 'json' ? 'json' : 'md';
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`aidev-${toolPick.toolId}-results.${ext}`),
        filters:
          formatPick.format === 'json'
            ? { JSON: ['json'] }
            : { Markdown: ['md'] },
      });

      if (uri) {
        // Use the BaseTool's export via a simple inline formatter
        const content =
          formatPick.format === 'json'
            ? JSON.stringify(result, null, 2)
            : formatResultAsMarkdown(toolPick.label, result);

        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
        await vscode.window.showTextDocument(uri);
      }
    }),
  );

  // Set mode command
  disposables.push(
    vscode.commands.registerCommand('aidev.setMode', async () => {
      const current = settings.current.mode;
      const picked = await vscode.window.showQuickPick(
        VALID_MODES.map((m) => ({
          label: m,
          description: m === current ? '(current)' : `Switch to ${m} mode`,
        })),
        { placeHolder: `Current mode: ${current}` },
      );

      if (picked && picked.label !== current) {
        const config = vscode.workspace.getConfiguration('aidev');
        await config.update('mode', picked.label, vscode.ConfigurationTarget.Global);
      }
    }),
  );

  // Helper to extract tool ID from tree item context
  function extractToolIdFromContext(context: unknown): ToolId | undefined {
    if (context && typeof context === 'object' && 'resourceUri' in context) {
      const uri = (context as { resourceUri: vscode.Uri }).resourceUri;
      if (uri && uri.scheme === 'aidev' && uri.path.startsWith('/tool/')) {
        const toolId = uri.path.replace('/tool/', '') as ToolId;
        if (TOOL_REGISTRY.some((t) => t.id === toolId)) {
          return toolId;
        }
      }
    }
    return undefined;
  }

  // Tool context menu commands (work with any tool via argument)
  disposables.push(
    vscode.commands.registerCommand('aidev.tool.run', async (context?: unknown) => {
      let toolId = extractToolIdFromContext(context);
      if (!toolId) {
        // If called from menu without context, show picker
        const selected = await vscode.window.showQuickPick(
          TOOL_REGISTRY.map((t) => ({ label: t.name, toolId: t.id as ToolId })),
          { placeHolder: 'Select tool to run' },
        );
        if (!selected) return;
        toolId = selected.toolId;
      }
      await toolRunner.run(toolId);
    }),
  );

  disposables.push(
    vscode.commands.registerCommand('aidev.tool.clear', async (context?: unknown) => {
      let toolId = extractToolIdFromContext(context);
      if (!toolId) {
        const selected = await vscode.window.showQuickPick(
          TOOL_REGISTRY.map((t) => ({ label: t.name, toolId: t.id as ToolId })),
          { placeHolder: 'Select tool to clear' },
        );
        if (!selected) return;
        toolId = selected.toolId;
      }
      // Note: ToolRunner doesn't have a clear method yet
      // For now, just show a message - results will be replaced on next run
      const tool = TOOL_REGISTRY.find((t) => t.id === toolId);
      void vscode.window.showInformationMessage(
        `Results for ${tool?.name ?? toolId} will be cleared on next run.`,
      );
    }),
  );

  disposables.push(
    vscode.commands.registerCommand('aidev.tool.export', async (context?: unknown) => {
      let toolId = extractToolIdFromContext(context);
      if (!toolId) {
        const selected = await vscode.window.showQuickPick(
          TOOL_REGISTRY.map((t) => {
            const result = toolRunner.getLastResult(t.id as ToolId);
            return {
              label: t.name,
              description: result ? `${String(result.summary.totalFindings)} findings` : 'No results',
              toolId: t.id as ToolId,
            };
          }),
          { placeHolder: 'Select tool to export' },
        );
        if (!selected) return;
        toolId = selected.toolId;
      }

      const result = toolRunner.getLastResult(toolId);
      if (!result) {
        const tool = TOOL_REGISTRY.find((t) => t.id === toolId);
        void vscode.window.showInformationMessage(
          `No results to export for ${tool?.name ?? toolId}. Run the tool first.`,
        );
        return;
      }

      const tool = TOOL_REGISTRY.find((t) => t.id === toolId);
      const formatPick = await vscode.window.showQuickPick(
        [
          { label: 'JSON', description: 'Machine-readable format', format: 'json' as ExportFormat },
          {
            label: 'Markdown',
            description: 'Human-readable format',
            format: 'markdown' as ExportFormat,
          },
        ],
        { placeHolder: 'Export format' },
      );

      if (!formatPick) return;

      const ext = formatPick.format === 'json' ? 'json' : 'md';
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`aidev-${toolId}-results.${ext}`),
        filters:
          formatPick.format === 'json'
            ? { JSON: ['json'] }
            : { Markdown: ['md'] },
      });

      if (uri) {
        const content =
          formatPick.format === 'json'
            ? JSON.stringify(result, null, 2)
            : formatResultAsMarkdown(tool?.name ?? toolId, result);

        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
        await vscode.window.showTextDocument(uri);
      }
    }),
  );

  disposables.push(
    vscode.commands.registerCommand('aidev.tool.configure', async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'aidev');
    }),
  );

  return disposables;
}

/**
 * Quick markdown formatter for export.
 * Used when the tool instance isn't readily available.
 */
function formatResultAsMarkdown(
  toolName: string,
  result: import('@aidev/core').ScanResult,
): string {
  const lines: string[] = [];
  lines.push(`# ${toolName} — Results`);
  lines.push('');
  lines.push(`**Status**: ${result.status}`);
  lines.push(`**Findings**: ${String(result.summary.totalFindings)}`);
  lines.push(`**Files scanned**: ${String(result.summary.filesScanned)}`);
  lines.push('');

  if (result.findings.length > 0) {
    lines.push('## Findings');
    lines.push('');
    for (const f of result.findings) {
      lines.push(
        `### [${f.severity.toUpperCase()}] ${f.title}`,
      );
      lines.push('');
      lines.push(f.description);
      lines.push('');
      lines.push(`File: \`${f.location.filePath}:${String(f.location.startLine)}\``);
      if (f.suggestedFix) {
        lines.push('');
        lines.push(`**Fix**: ${f.suggestedFix.description}`);
        lines.push('```');
        lines.push(f.suggestedFix.replacement);
        lines.push('```');
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}
