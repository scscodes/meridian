import * as vscode from "vscode";
import { readSetting } from "../infrastructure/settings";

const MAX_LOG_LENGTH = 4000;

export function isSensitiveLoggingEnabled(): boolean {
  return readSetting("security.logging.sensitive") === "allow";
}

export function sanitizeForLogs(input: unknown): string {
  let raw: string;
  if (typeof input === "string") {
    raw = input;
  } else {
    try {
      raw = JSON.stringify(input, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);
    } catch {
      raw = "[UNSERIALIZABLE_LOG_PAYLOAD]";
    }
  }

  let sanitized = raw;
  sanitized = sanitized.replace(/\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/g, "[REDACTED_TOKEN]");
  sanitized = sanitized.replace(/\b(?:api[_-]?key|token|secret)\s*[:=]\s*["']?[^\s"']+/gi, "[REDACTED_SECRET]");

  if (sanitized.length > MAX_LOG_LENGTH) {
    sanitized = `${sanitized.slice(0, MAX_LOG_LENGTH)}...[TRUNCATED]`;
  }
  return sanitized;
}

export async function copyWithPolicy(text: string, label: string): Promise<boolean> {
  const autoCopy = readSetting("security.clipboard.autoCopy");
  if (autoCopy) {
    await vscode.env.clipboard.writeText(text);
    return true;
  }

  const selection = await vscode.window.showInformationMessage(
    `${label} is ready.`,
    "Copy to Clipboard"
  );
  if (selection === "Copy to Clipboard") {
    await vscode.env.clipboard.writeText(text);
    return true;
  }
  return false;
}

export function getGitNetworkMode(): "allow" | "prompt" | "deny" {
  // Narrow at runtime: VS Code does not enforce enum membership on user-supplied values.
  const mode = readSetting("security.gitNetwork.mode");
  return mode === "allow" || mode === "prompt" || mode === "deny" ? mode : "prompt";
}

export function getAllowedGitHosts(): string[] {
  const configured = readSetting("security.gitNetwork.allowedHosts");
  return configured.map((h) => h.trim().toLowerCase()).filter(Boolean);
}
