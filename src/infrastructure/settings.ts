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
import { MERIDIAN_DIR } from "../constants";

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
  "retention.artifacts.maxCount":     50 as number,
  "retention.artifacts.maxAgeDays":   30 as number,
  "retention.runLog.maxEvents":       5000 as number,
  "sessionBriefing.autoLaunch":       false as boolean,
  "startup.enableFileWatchers":       true as boolean,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type SettingValue<K extends SettingKey> = typeof SETTING_DEFAULTS[K];

/**
 * What a (re)parse of `.meridian/settings.json` found wrong. All three are
 * silently *ignored* at read time (fall-through semantics are the contract);
 * the diagnostics exist so a typo'd key or mis-typed value is reported once
 * instead of failing silently forever.
 */
export interface WorkspaceSettingsDiagnostics {
  /** File-level failure: unreadable, malformed JSON, or not a JSON object. */
  parseError?: string;
  /** Keys with no SETTING_DEFAULTS counterpart (typo'd or retired). */
  unknownKeys: string[];
  /** Known keys whose value shape mismatches the typed default. */
  mismatchedKeys: string[];
}

export type WorkspaceSettingsDiagnosticsListener = (
  diagnostics: WorkspaceSettingsDiagnostics,
  file: string
) => void;

let diagnosticsListener: WorkspaceSettingsDiagnosticsListener | null = null;

/**
 * Register the sink for settings-file diagnostics (main.ts wires the Meridian
 * output channel). Invoked at most once per file change — parsing is keyed to
 * the file's mtime, so a hot readSetting() path never re-emits. Listener
 * errors are swallowed; reporting must never break a settings read.
 */
export function setWorkspaceSettingsDiagnosticsListener(
  listener: WorkspaceSettingsDiagnosticsListener | null
): void {
  diagnosticsListener = listener;
}

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

/** Key-level audit of a parsed overrides object (file-level errors are handled by the caller). */
function diagnoseOverrides(values: Record<string, unknown>): WorkspaceSettingsDiagnostics {
  const unknownKeys: string[] = [];
  const mismatchedKeys: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (!(key in SETTING_DEFAULTS)) {
      unknownKeys.push(key);
    } else if (value !== null && !overrideMatchesDefault(value, key as SettingKey)) {
      // JSON null is the documented "not supplied" idiom — never flagged.
      mismatchedKeys.push(key);
    }
  }
  return { unknownKeys, mismatchedKeys };
}

function emitDiagnostics(diagnostics: WorkspaceSettingsDiagnostics, file: string): void {
  if (!diagnostics.parseError && diagnostics.unknownKeys.length === 0 && diagnostics.mismatchedKeys.length === 0) {
    return;
  }
  try {
    diagnosticsListener?.(diagnostics, file);
  } catch {
    // A broken listener must never break a settings read.
  }
}

function readWorkspaceSettings(): Record<string, unknown> {
  const root = vscodeWorkspaceRoot();
  if (!root) return {};
  const file = path.join(root, MERIDIAN_DIR, "settings.json");

  // An absent file is the normal case: no overrides, no diagnostic.
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    workspaceSettingsCache = null;
    return {};
  }

  if (
    workspaceSettingsCache &&
    workspaceSettingsCache.root === root &&
    workspaceSettingsCache.mtime === stat.mtimeMs
  ) {
    return workspaceSettingsCache.values;
  }

  // Cache miss = the file changed (or first read): parse once, audit once.
  // A failed parse is cached against the same mtime so a malformed file is
  // neither re-parsed nor re-reported on every readSetting() call.
  let values: Record<string, unknown> = {};
  let diagnostics: WorkspaceSettingsDiagnostics;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      values = parsed as Record<string, unknown>;
      diagnostics = diagnoseOverrides(values);
    } else {
      diagnostics = { parseError: "not a JSON object of key/value pairs", unknownKeys: [], mismatchedKeys: [] };
    }
  } catch (e) {
    diagnostics = {
      parseError: e instanceof Error ? e.message : String(e),
      unknownKeys: [],
      mismatchedKeys: [],
    };
  }
  workspaceSettingsCache = { mtime: stat.mtimeMs, root, values };
  emitDiagnostics(diagnostics, file);
  return values;
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
