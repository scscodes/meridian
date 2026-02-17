import * as vscode from 'vscode';
import type { OperatingMode } from '@aidev/core';

/** Status bar icons per operating mode — centralized, no scattered strings */
const MODE_ICONS: Record<OperatingMode, string> = {
  performance: '$(rocket)',
  balanced: '$(dashboard)',
  economy: '$(leaf)',
};

/** Spinner shown while a tool is running */
const BUSY_SPINNER = '$(sync~spin)';

export interface StatusBarApi {
  setBusy(message: string): void;
  clearBusy(): void;
}

/**
 * Create the single AIDev status bar item and return API for busy state.
 *
 * Default: shows current mode (e.g. "AIDev: balanced"), clickable → mode picker.
 * When busy: shows spinner + "AIDev: Scanning..." (or custom message).
 */
export function createStatusBarItems(
  _context: vscode.ExtensionContext,
): { disposables: vscode.Disposable[]; statusBar: StatusBarApi } {
  const modeItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  modeItem.command = 'aidev.setMode';
  let isBusy = false;
  let busyMessage = 'Scanning...';

  function updateDisplay(): void {
    if (isBusy) {
      modeItem.text = `${BUSY_SPINNER} AIDev: ${busyMessage}`;
      modeItem.tooltip = 'AIDev is running…';
    } else {
      const config = vscode.workspace.getConfiguration('aidev');
      const mode = config.get<OperatingMode>('mode', 'balanced');
      const icon = MODE_ICONS[mode] ?? '$(beaker)';
      modeItem.text = `${icon} AIDev: ${mode}`;
      modeItem.tooltip = `AIDev operating mode: ${mode}\nClick to change.`;
    }
  }

  updateDisplay();
  modeItem.show();

  const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('aidev.mode') && !isBusy) {
      updateDisplay();
    }
  });

  const statusBar: StatusBarApi = {
    setBusy(message: string): void {
      isBusy = true;
      busyMessage = message;
      updateDisplay();
    },
    clearBusy(): void {
      isBusy = false;
      updateDisplay();
    },
  };

  return {
    disposables: [modeItem, configListener],
    statusBar,
  };
}
