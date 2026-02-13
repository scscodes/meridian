import * as vscode from 'vscode';
import type { OperatingMode } from '@aidev/core';

/** Status bar icons per operating mode — centralized, no scattered strings */
const MODE_ICONS: Record<OperatingMode, string> = {
  performance: '$(rocket)',
  balanced: '$(dashboard)',
  economy: '$(leaf)',
};

/**
 * Create status bar items for AIDev.
 *
 * Shows: current operating mode (clickable → opens mode picker)
 * Future: scan progress indicator
 */
export function createStatusBarItems(_context: vscode.ExtensionContext): vscode.Disposable[] {
  const modeItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  modeItem.command = 'aidev.setMode';
  updateModeDisplay(modeItem);
  modeItem.show();

  // React to mode changes in real-time
  const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('aidev.mode')) {
      updateModeDisplay(modeItem);
    }
  });

  return [modeItem, configListener];
}

function updateModeDisplay(item: vscode.StatusBarItem): void {
  const config = vscode.workspace.getConfiguration('aidev');
  const mode = config.get<OperatingMode>('mode', 'balanced');
  const icon = MODE_ICONS[mode] ?? '$(beaker)';

  item.text = `${icon} AIDev: ${mode}`;
  item.tooltip = `AIDev operating mode: ${mode}\nClick to change.`;
}
