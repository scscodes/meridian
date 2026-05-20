/**
 * Settings — typed, test-mockable accessor for all live `meridian.*` user settings.
 *
 * Single source of truth: SETTING_DEFAULTS lists every key declared in
 * package.json contributes.configuration.properties. tests/manifest.test.ts
 * asserts parity so neither side can drift.
 *
 * Precedence (ADR 014): `.meridian/settings.json` in the workspace root takes
 * priority over VS Code `meridian.*` settings. Sparse — only present keys
 * override; absent keys fall through to VS Code config / typed default.
 * Untyped JSON deserialization is acceptable here; security-sensitive keys
 * are narrowed at the policy boundary (ADR 013 Rule 4).
 */

import * as fs from "fs";
import * as path from "path";
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

let workspaceSettingsCache:
  | { mtime: number; root: string; values: Record<string, unknown> }
  | null = null;

function vscodeWorkspaceRoot(): string | undefined {
  try {
    return (vscode as unknown as {
      workspace?: { workspaceFolders?: ReadonlyArray<{ uri: { fsPath: string } }> };
    }).workspace?.workspaceFolders?.[0]?.uri.fsPath;
  } catch {
    return undefined;
  }
}

function readWorkspaceSettings(): Record<string, unknown> {
  const root = vscodeWorkspaceRoot();
  if (!root) return {};
  const file = path.join(root, ".meridian", "settings.json");
  try {
    const stat = fs.statSync(file);
    if (
      workspaceSettingsCache &&
      workspaceSettingsCache.root === root &&
      workspaceSettingsCache.mtime === stat.mtimeMs
    ) {
      return workspaceSettingsCache.values;
    }
    const raw = fs.readFileSync(file, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    const values: Record<string, unknown> =
      typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    workspaceSettingsCache = { mtime: stat.mtimeMs, root, values };
    return values;
  } catch {
    // Missing file, malformed JSON, ENOENT — all collapse to "no overrides".
    workspaceSettingsCache = null;
    return {};
  }
}

// Shape check against the typed default. Rejects mismatched workspace-file
// overrides so a malformed JSON value cannot silently downgrade a policy
// callsite (e.g. a string supplied where a string[] is expected for
// `security.gitNetwork.allowedHosts`). null/undefined are treated as "not
// supplied" so the JSON `null` literal cannot clear a typed default.
function overrideMatchesDefault<K extends SettingKey>(value: unknown, key: K): boolean {
  if (value === null || value === undefined) return false;
  const def: unknown = SETTING_DEFAULTS[key];
  if (Array.isArray(def)) {
    return Array.isArray(value) && value.every((v) => typeof v === "string");
  }
  return typeof value === typeof def;
}

export function readSetting<K extends SettingKey>(key: K): SettingValue<K> {
  const overrides = readWorkspaceSettings();
  if (key in overrides && overrideMatchesDefault(overrides[key], key)) {
    // Shape-validated at this trust boundary; security-sensitive callsites
    // additionally narrow at the policy boundary (ADR 013 Rule 4).
    return overrides[key] as SettingValue<K>;
  }
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
