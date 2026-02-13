import type {
  IModelProvider,
  ResolvedModel,
  ModelRequestOptions,
  ModelResponse,
} from '@aidev/core';

/**
 * Model provider using direct API keys (Anthropic, OpenAI).
 *
 * Intended as a fallback/override when IDE-provided models are unavailable
 * or when the user needs a specific model not exposed by their IDE.
 *
 * Configuration comes from aidev.directApi.* settings.
 */
export class DirectApiProvider implements IModelProvider {
  readonly id = 'direct-api';
  readonly name = 'Direct API';

  async isAvailable(): Promise<boolean> {
    // TODO: Check if apiKey is configured and non-empty in settings
    return false;
  }

  async listModels(): Promise<ResolvedModel[]> {
    // TODO: Return known model catalog for the configured provider
    // Anthropic: claude-3-opus, claude-3-sonnet, claude-3-haiku, etc.
    // OpenAI: gpt-4o, gpt-4o-mini, etc.
    return [];
  }

  async sendRequest(_options: ModelRequestOptions): Promise<ModelResponse> {
    // TODO: Implementation steps:
    // 1. Read directApi config from settings
    // 2. Resolve model ID via tier map
    // 3. Build request body for the configured provider
    // 4. Send via fetch() to the provider's API
    // 5. Parse response and return ModelResponse
    throw new Error('DirectApiProvider.sendRequest: not yet implemented');
  }

  dispose(): void {
    // No persistent resources to release
  }
}
