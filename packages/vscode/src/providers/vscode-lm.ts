import * as vscode from 'vscode';
import type {
  IModelProvider,
  ResolvedModel,
  ModelRequestOptions,
  ModelResponse,
} from '@aidev/core';

/**
 * Model provider using the VSCode Language Model API (vscode.lm).
 *
 * Works with:
 * - GitHub Copilot in VSCode (models exposed via Copilot subscription)
 * - Cursor's built-in models (exposed via the same API surface)
 *
 * The vscode.lm API is available in VSCode 1.93+ (stable since 1.95).
 */
export class VscodeLmProvider implements IModelProvider {
  readonly id = 'vscode-lm';
  readonly name = 'IDE Language Models';

  async isAvailable(): Promise<boolean> {
    try {
      const models = await vscode.lm.selectChatModels();
      return models.length > 0;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ResolvedModel[]> {
    try {
      const models = await vscode.lm.selectChatModels();
      return models.map((m) => ({
        id: m.id,
        name: m.name,
        tier: 'mid' as const, // Default; user assigns tiers via settings
        role: 'chat' as const,
        provider: m.vendor,
      }));
    } catch {
      return [];
    }
  }

  async sendRequest(_options: ModelRequestOptions): Promise<ModelResponse> {
    // TODO: Implementation steps:
    // 1. Read current mode from settings
    // 2. Resolve tier for the given role (resolveTier from @aidev/core)
    // 3. Resolve model ID from tier map (resolveModelId from @aidev/core)
    // 4. Select matching model via vscode.lm.selectChatModels({ id: modelId })
    // 5. Build vscode.LanguageModelChatMessage array
    // 6. Call model.sendRequest() with messages
    // 7. Collect streamed response fragments
    // 8. Return ModelResponse
    throw new Error('VscodeLmProvider.sendRequest: not yet implemented');
  }

  dispose(): void {
    // No persistent resources to release
  }
}
