import * as vscode from 'vscode';
import type {
  IModelProvider,
  ResolvedModel,
  ModelRequestOptions,
  ModelResponse,
  ModelTier,
  ModelRole,
  OperatingMode,
  StopReason,
  ToolDefinition,
  ToolCall,
} from '@aidev/core';
import { resolveTier, resolveModelId } from '@aidev/core';
import type { SettingsManager } from '../settings/index.js';

/**
 * Model provider using the VSCode Language Model API (vscode.lm).
 * Works with GitHub Copilot in VSCode (models exposed via Copilot subscription).
 * Requires VSCode 1.95+.
 */
export class VscodeLmProvider implements IModelProvider {
  readonly id = 'vscode-lm';
  readonly name = 'IDE Language Models';

  private settingsManager: SettingsManager | undefined;

  /**
   * Inject settings manager after construction.
   * Called by ProviderManager during initialization.
   */
  setSettingsManager(settings: SettingsManager): void {
    this.settingsManager = settings;
  }

  async isAvailable(): Promise<boolean> {
    // Check if vscode.lm API exists
    if (!vscode.lm) {
      console.log('AIDev: vscode.lm API not available');
      return false;
    }

    try {
      const models = await vscode.lm.selectChatModels();
      console.log(`AIDev: vscode.lm.selectChatModels() returned ${String(models.length)} model(s)`);
      
      if (models.length > 0) {
        console.log(`AIDev: Available models: ${models.map(m => `${m.name} (${m.id})`).join(', ')}`);
        return true;
      } else {
        console.log('AIDev: No models available from vscode.lm API. Ensure GitHub Copilot is installed and signed in.');
        return false;
      }
    } catch (error) {
      console.error('AIDev: Error checking vscode.lm availability:', error);
      return false;
    }
  }

  async listModels(): Promise<ResolvedModel[]> {
    if (!vscode.lm) {
      console.log('AIDev: vscode.lm API not available for listModels');
      return [];
    }

    try {
      const models = await vscode.lm.selectChatModels();
      console.log(`AIDev: listModels() found ${String(models.length)} model(s)`);
      
      return models.map((m) => ({
        id: m.id,
        name: m.name,
        tier: 'mid' as ModelTier,
        role: 'chat' as ModelRole,
        provider: m.vendor,
      }));
    } catch (error) {
      console.error('AIDev: Error listing models:', error);
      return [];
    }
  }

  async sendRequest(options: ModelRequestOptions): Promise<ModelResponse> {
    if (!this.settingsManager) {
      throw new Error('VscodeLmProvider: SettingsManager not initialized.');
    }

    if (!vscode.lm) {
      throw new Error('vscode.lm API is not available. This extension requires VSCode 1.95+.');
    }

    const settings = this.settingsManager.current;
    const model = await this.selectModel(settings.mode, options.role, settings.modelTiers);

    if (!model) {
      // Try to get any available model as last resort
      console.log('AIDev: Model selection returned undefined, checking for any available models...');
      const available = await vscode.lm.selectChatModels();
      console.log(`AIDev: Found ${String(available.length)} available model(s) for fallback`);
      
      if (available.length === 0) {
        const errorMsg =
          'No language models available from vscode.lm API. ' +
          'Ensure GitHub Copilot is installed and signed in.';
        console.error(`AIDev: ${errorMsg}`);
        throw new Error(errorMsg);
      }
      // Use first available model if selection failed
      const fallbackModel = available[0];
      console.warn(
        `AIDev: Model selection failed, using fallback: ${fallbackModel.name} (${fallbackModel.id})`,
      );
      return this.sendRequestWithModel(fallbackModel, options, settings);
    }

    return this.sendRequestWithModel(model, options, settings);
  }

  private async sendRequestWithModel(
    model: vscode.LanguageModelChat,
    options: ModelRequestOptions,
    settings: import('@aidev/core').ExtensionSettings,
  ): Promise<ModelResponse> {
    // Build messages for the vscode.lm API with native tool calling support
    const messages = options.messages.map((msg) => {
      switch (msg.role) {
        case 'system':
          return vscode.LanguageModelChatMessage.User(`[System] ${msg.content}`);
        case 'user':
          return vscode.LanguageModelChatMessage.User(msg.content);
        case 'assistant': {
          // Native tool calling: attempt to use native format if toolCalls are present
          if (msg.toolCalls && msg.toolCalls.length > 0) {
            try {
              // Convert our ToolCall[] to vscode.lm format
              const toolCalls = msg.toolCalls.map((tc) => ({
                name: tc.name,
                arguments: tc.arguments,
              }));
              // Try native format (may not be supported in all VSCode versions)
              return vscode.LanguageModelChatMessage.Assistant(msg.content, toolCalls);
            } catch (error) {
              // Fallback to text serialization if native format fails
              console.log('AIDev: Native tool call format not supported, using text fallback:', error);
              const toolCallSummary = msg.toolCalls
                .map((tc) => `[Tool Call: ${tc.name}(${JSON.stringify(tc.arguments)})]`)
                .join('\n');
              const content = msg.content ? `${msg.content}\n${toolCallSummary}` : toolCallSummary;
              return vscode.LanguageModelChatMessage.Assistant(content);
            }
          }
          return vscode.LanguageModelChatMessage.Assistant(msg.content);
        }
        case 'tool_result':
          // Native tool result format - attempt native format first
          if (msg.toolCallId) {
            try {
              // Try native tool result format (may not be supported)
              return vscode.LanguageModelChatMessage.User(msg.content, {
                name: '', // Tool name not needed for results
                result: msg.content,
              });
            } catch (error) {
              // Fallback to text serialization
              console.log('AIDev: Native tool result format not supported, using text fallback:', error);
              return vscode.LanguageModelChatMessage.User(
                `[Tool Result for ${msg.toolCallId}]\n${msg.content}`,
              );
            }
          }
          // Fallback: serialize as text
          return vscode.LanguageModelChatMessage.User(
            `[Tool Result${msg.toolCallId ? ` for ${msg.toolCallId}` : ''}]\n${msg.content}`,
          );
        default:
          return vscode.LanguageModelChatMessage.User(msg.content);
      }
    });

    // Convert ToolDefinition[] to vscode.lm format
    const tools: vscode.LanguageModelToolInformation[] | undefined = options.tools?.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));

    // Send the request with native tool support
    const requestOptions: vscode.LanguageModelChatRequestOptions = {
      ...(tools && tools.length > 0 ? { tools } : {}),
    };

    const cancellation = new vscode.CancellationTokenSource();

    // Wire up external abort signal to VSCode cancellation
    if (options.signal) {
      options.signal.addEventListener('abort', () => cancellation.cancel(), { once: true });
    }

    try {
      const response = await model.sendRequest(messages, requestOptions, cancellation.token);

      // Collect the streamed response and tool calls
      let content = '';
      const toolCalls: ToolCall[] = [];

      // Stream text content
      for await (const fragment of response.text) {
        content += fragment;
      }

      // Parse tool calls from response
      // VSCode's LanguageModelChatResponse may expose tool calls via response.toolCalls
      // or through the stream. Check both possibilities.
      try {
        // Check if response has a toolCalls property (native API)
        if ('toolCalls' in response) {
          const responseToolCalls = (response as {
            toolCalls?: Array<{
              name: string;
              arguments: Record<string, unknown>;
              id?: string;
            }>;
          }).toolCalls;
          if (Array.isArray(responseToolCalls) && responseToolCalls.length > 0) {
            for (const tc of responseToolCalls) {
              toolCalls.push({
                id: tc.id ?? `tool_${Date.now()}_${Math.random()}`,
                name: tc.name,
                arguments: tc.arguments ?? {},
              });
            }
          }
        }
      } catch (error) {
        // If tool calls aren't available in this format, log and continue
        console.log('AIDev: Tool calls not available in response format:', error);
      }

      // Determine stop reason
      let stopReason: StopReason = 'end_turn';
      if (toolCalls.length > 0) {
        stopReason = 'tool_use';
      }

      return {
        content,
        model: {
          id: model.id,
          name: model.name,
          tier: resolveTier(settings.mode, options.role),
          role: options.role,
          provider: model.vendor,
        },
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        stopReason,
      };
    } finally {
      cancellation.dispose();
    }
  }

  dispose(): void {
    // No persistent resources
  }

  // ─── Private ────────────────────────────────────────────────────────────

  /**
   * Select the best available model for the given mode and role.
   *
   * Resolution strategy:
   * 1. Resolve the target model ID from tier map
   * 2. Try exact match against available models
   * 3. Try partial match (model ID contains the configured string)
   * 4. Fall back to first available model
   */
  private async selectModel(
    mode: OperatingMode,
    role: ModelRole,
    tierMap: { high: string; mid: string; low: string },
  ): Promise<vscode.LanguageModelChat | undefined> {
    const targetId = resolveModelId(mode, role, tierMap);
    const available = await vscode.lm.selectChatModels();

    if (available.length === 0) return undefined;

    // If no model configured for this tier, use first available
    if (!targetId) return available[0];

    // Exact match
    const exact = available.find((m) => m.id === targetId);
    if (exact) return exact;

    // Partial match — configured ID is a substring of the model ID
    // Allows users to configure 'claude-3-opus' to match 'claude-3-opus-20240229'
    const partial = available.find(
      (m) => m.id.includes(targetId) || m.name.toLowerCase().includes(targetId.toLowerCase()),
    );
    if (partial) return partial;

    // Last resort: first available
    console.warn(
      `AIDev: Model "${targetId}" not found among ${String(available.length)} available models. Using "${available[0].name}".`,
    );
    return available[0];
  }
}
