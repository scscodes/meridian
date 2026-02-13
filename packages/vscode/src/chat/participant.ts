import * as vscode from 'vscode';
import { TOOL_REGISTRY, getToolByCommand } from '@aidev/core';
import type { ProviderManager } from '../providers/index.js';

const PARTICIPANT_ID = 'aidev.chat';

/**
 * Register the @aidev chat participant for VSCode Copilot Chat.
 *
 * In Cursor, the Chat Participant API may not be available.
 * Features degrade gracefully — all tools remain accessible via
 * commands (palette + sidebar).
 */
export function registerChatParticipant(
  _context: vscode.ExtensionContext,
  _providerManager: ProviderManager,
): vscode.Disposable[] {
  // Guard: Chat Participant API may not exist in all environments
  if (!vscode.chat?.createChatParticipant) {
    console.log('AIDev: Chat Participant API not available — commands still work.');
    return [];
  }

  const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handleChatRequest);
  participant.iconPath = new vscode.ThemeIcon('beaker');

  return [participant];
}

/**
 * Handle incoming chat requests routed to @aidev.
 */
async function handleChatRequest(
  request: vscode.ChatRequest,
  _context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  _token: vscode.CancellationToken,
): Promise<void> {
  const { command } = request;

  if (!command) {
    // No command — show help
    stream.markdown('### AIDev Tools\n\n');
    for (const tool of TOOL_REGISTRY) {
      stream.markdown(`- \`/${tool.chatCommand}\` — ${tool.description}\n`);
    }
    return;
  }

  const entry = getToolByCommand(command);
  if (!entry) {
    stream.markdown(`Unknown command: \`/${command}\`. Type \`@aidev\` for available commands.`);
    return;
  }

  // TODO: Route to the actual tool implementation.
  // For now, acknowledge and indicate not yet implemented.
  stream.markdown(`**${entry.name}** — *not yet implemented.*\n\n`);
  stream.markdown(`This will: ${entry.description}`);
}
