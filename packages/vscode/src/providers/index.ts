import * as vscode from 'vscode';
import type { IModelProvider } from '@aidev/core';
import { VscodeLmProvider } from './vscode-lm.js';
import { DirectApiProvider } from './direct-api.js';

/**
 * Manages model provider lifecycle and selection based on settings.
 *
 * Owns the provider instances and switches between them when
 * the user changes aidev.providerSource.
 */
export class ProviderManager implements vscode.Disposable {
  private providers = new Map<string, IModelProvider>();
  private activeProvider: IModelProvider | undefined;

  /**
   * Initialize providers and subscribe to settings changes.
   */
  async initialize(context: vscode.ExtensionContext): Promise<void> {
    // Register built-in providers
    const vscodeLm = new VscodeLmProvider();
    this.providers.set(vscodeLm.id, vscodeLm);

    const directApi = new DirectApiProvider();
    this.providers.set(directApi.id, directApi);

    // Set active provider from current settings
    await this.refreshFromSettings();

    // React to settings changes — supports in-flight mode switching
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('aidev')) {
          void this.refreshFromSettings();
        }
      }),
    );
  }

  /**
   * Read current settings and activate the appropriate provider.
   */
  async refreshFromSettings(): Promise<void> {
    const config = vscode.workspace.getConfiguration('aidev');
    const source = config.get<string>('providerSource', 'ide');
    const providerId = source === 'direct' ? 'direct-api' : 'vscode-lm';
    const provider = this.providers.get(providerId);

    if (provider && (await provider.isAvailable())) {
      this.activeProvider = provider;
    } else {
      // Fallback: try the other provider
      for (const [id, p] of this.providers) {
        if (id !== providerId && (await p.isAvailable())) {
          this.activeProvider = p;
          break;
        }
      }
    }
  }

  /**
   * Get the currently active model provider. May be undefined if
   * no provider is available/configured.
   */
  getActiveProvider(): IModelProvider | undefined {
    return this.activeProvider;
  }

  /**
   * Get a specific provider by ID.
   */
  getProvider(id: string): IModelProvider | undefined {
    return this.providers.get(id);
  }

  dispose(): void {
    for (const provider of this.providers.values()) {
      provider.dispose();
    }
    this.providers.clear();
    this.activeProvider = undefined;
  }
}
