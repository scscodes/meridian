/**
 * Configuration Provider — Typed schema, validation.
 */

import * as vscode from "vscode";
import { ConfigProvider, AppError, Result, failure, success } from "../types";
import { PruneConfig, PRUNE_DEFAULTS } from "../domains/hygiene/analytics-types";

/**
 * Typed configuration schema.
 * No magic keys; all config paths are explicit constants.
 */
export const CONFIG_KEYS = {
  GIT_AUTOFETCH: "git.autofetch" as const,
  GIT_BRANCH_CLEAN: "git.branchClean" as const,
  HYGIENE_ENABLED: "hygiene.enabled" as const,
  HYGIENE_SCAN_INTERVAL: "hygiene.scanInterval" as const,
  CHAT_MODEL: "chat.model" as const,
  CHAT_CONTEXT_LINES: "chat.contextLines" as const,
  LOG_LEVEL: "log.level" as const,
} as const;

export type ConfigKey = typeof CONFIG_KEYS[keyof typeof CONFIG_KEYS];

interface ConfigSchema {
  [CONFIG_KEYS.GIT_AUTOFETCH]: boolean;
  [CONFIG_KEYS.GIT_BRANCH_CLEAN]: boolean;
  [CONFIG_KEYS.HYGIENE_ENABLED]: boolean;
  [CONFIG_KEYS.HYGIENE_SCAN_INTERVAL]: number; // minutes
  [CONFIG_KEYS.CHAT_MODEL]: string;
  [CONFIG_KEYS.CHAT_CONTEXT_LINES]: number;
  [CONFIG_KEYS.LOG_LEVEL]: "debug" | "info" | "warn" | "error";
}

/**
 * Default configuration values.
 */
const DEFAULTS: ConfigSchema = {
  [CONFIG_KEYS.GIT_AUTOFETCH]: false,
  [CONFIG_KEYS.GIT_BRANCH_CLEAN]: true,
  [CONFIG_KEYS.HYGIENE_ENABLED]: true,
  [CONFIG_KEYS.HYGIENE_SCAN_INTERVAL]: 60,
  [CONFIG_KEYS.CHAT_MODEL]: "gpt-4",
  [CONFIG_KEYS.CHAT_CONTEXT_LINES]: 50,
  [CONFIG_KEYS.LOG_LEVEL]: "info",
};

export class Config implements ConfigProvider {
  private store: Partial<ConfigSchema> = {};

  /**
   * Load config from VS Code workspace settings.
   */
  async initialize(): Promise<Result<void>> {
    try {
      const cfg = vscode.workspace.getConfiguration("meridian");
      this.store = {
        [CONFIG_KEYS.GIT_AUTOFETCH]: cfg.get<boolean>("git.autofetch") ?? DEFAULTS[CONFIG_KEYS.GIT_AUTOFETCH],
        [CONFIG_KEYS.GIT_BRANCH_CLEAN]: cfg.get<boolean>("git.branchClean") ?? DEFAULTS[CONFIG_KEYS.GIT_BRANCH_CLEAN],
        [CONFIG_KEYS.HYGIENE_ENABLED]: cfg.get<boolean>("hygiene.enabled") ?? DEFAULTS[CONFIG_KEYS.HYGIENE_ENABLED],
        [CONFIG_KEYS.HYGIENE_SCAN_INTERVAL]: cfg.get<number>("hygiene.scanInterval") ?? DEFAULTS[CONFIG_KEYS.HYGIENE_SCAN_INTERVAL],
        [CONFIG_KEYS.CHAT_MODEL]: cfg.get<string>("chat.model") ?? DEFAULTS[CONFIG_KEYS.CHAT_MODEL],
        [CONFIG_KEYS.CHAT_CONTEXT_LINES]: cfg.get<number>("chat.contextLines") ?? DEFAULTS[CONFIG_KEYS.CHAT_CONTEXT_LINES],
        [CONFIG_KEYS.LOG_LEVEL]: cfg.get<"debug" | "info" | "warn" | "error">("log.level") ?? DEFAULTS[CONFIG_KEYS.LOG_LEVEL],
      };
      return success(void 0);
    } catch (err) {
      // Fall back to defaults so the extension still works
      this.store = { ...DEFAULTS };
      const error: AppError = {
        code: "CONFIG_INIT_ERROR",
        message: "Failed to initialize configuration",
        details: err,
      };
      return failure(error);
    }
  }

  get<T>(key: string, defaultValue?: T): T | undefined {
    const value = this.store[key as ConfigKey];
    if (value === undefined) {
      return defaultValue;
    }
    return value as T;
  }

  async set<T>(key: string, value: T): Promise<Result<void>> {
    try {
      this.store[key as ConfigKey] = value as any;
      // In extension context, would call vscode.workspace.getConfiguration().update()
      return success(void 0);
    } catch (err) {
      const error: AppError = {
        code: "CONFIG_SET_ERROR",
        message: `Failed to set config key '${key}'`,
        details: err,
      };
      return failure(error);
    }
  }

  /**
   * Read current prune config from VS Code settings (reads fresh each call).
   */
  getPruneConfig(): PruneConfig {
    const cfg = vscode.workspace.getConfiguration("meridian.hygiene.prune");
    return {
      minAgeDays: cfg.get<number>("minAgeDays", PRUNE_DEFAULTS.minAgeDays),
      maxSizeMB: cfg.get<number>("maxSizeMB", PRUNE_DEFAULTS.maxSizeMB),
      minLineCount: cfg.get<number>("minLineCount", PRUNE_DEFAULTS.minLineCount),
      categories: cfg.get<PruneConfig["categories"]>("categories", PRUNE_DEFAULTS.categories),
    };
  }

  /**
   * Export current configuration (for debugging).
   */
  exportAll(): Partial<ConfigSchema> {
    return { ...this.store };
  }
}
