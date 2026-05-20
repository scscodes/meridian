/**
 * Settings — typed, test-mockable accessor for all live `meridian.*` user settings.
 *
 * Single source of truth: SETTING_DEFAULTS lists every key declared in
 * package.json contributes.configuration.properties. tests/manifest.test.ts
 * asserts parity so neither side can drift.
 */

import * as vscode from "vscode";

export const SETTING_DEFAULTS = {
  "model.default":                    "gpt-4o" as string,
  "model.hygiene":                    "" as string,
  "model.git":                        "" as string,
  "security.lmEgress.mode":           "prompt" as "allow" | "prompt" | "deny",
  "security.gitNetwork.mode":         "prompt" as "allow" | "prompt" | "deny",
  "security.gitNetwork.allowedHosts": [] as string[],
  "security.clipboard.autoCopy":      false as boolean,
  "security.logging.sensitive":       "redact" as "redact" | "allow",
  "hygiene.prune.minAgeDays":         30 as number,
  "hygiene.prune.maxSizeMB":          1 as number,
  "hygiene.prune.minLineCount":       0 as number,
  "hygiene.prune.categories":         ["backup", "temp", "log", "artifact"] as readonly string[],
  "sessionBriefing.autoLaunch":       false as boolean,
  "startup.enableFileWatchers":       true as boolean,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type SettingValue<K extends SettingKey> = typeof SETTING_DEFAULTS[K];

export function readSetting<K extends SettingKey>(key: K): SettingValue<K> {
  // Single absorber for any vscode-side failure (incomplete test mocks, host
  // returning a malformed config proxy, etc). All callers get the typed default.
  try {
    const cfg = (vscode as unknown as {
      workspace?: { getConfiguration?: (section: string) => { get<T>(key: string, fallback: T): T } };
    }).workspace?.getConfiguration?.("meridian");
    if (!cfg) return SETTING_DEFAULTS[key];
    return cfg.get<SettingValue<K>>(key, SETTING_DEFAULTS[key]);
  } catch {
    return SETTING_DEFAULTS[key];
  }
}
