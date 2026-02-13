import * as vscode from 'vscode';
import { ProviderManager } from './providers/index.js';
import { registerCommands } from './commands/index.js';
import { registerChatParticipant } from './chat/index.js';
import { registerSidebar } from './sidebar/index.js';
import { createStatusBarItems } from './status/index.js';

let providerManager: ProviderManager | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('AIDev: Activating...');

  // Initialize model provider management
  providerManager = new ProviderManager();
  await providerManager.initialize(context);
  context.subscriptions.push(providerManager);

  // Register all components — order doesn't matter, they're independent
  context.subscriptions.push(
    ...registerCommands(context, providerManager),
    ...registerChatParticipant(context, providerManager),
    ...registerSidebar(context),
    ...createStatusBarItems(context),
  );

  console.log('AIDev: Activated.');
}

export function deactivate(): void {
  providerManager = undefined;
}
