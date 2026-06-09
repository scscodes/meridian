import * as vscode from "vscode";
import { readSetting } from "../infrastructure/settings";

const MAX_LM_PAYLOAD_LENGTH = 12000;

export async function enforceLmEgressPolicy(featureLabel: string): Promise<boolean> {
  const mode = readSetting("security.lmEgress.mode");
  if (mode === "allow") return true;
  if (mode === "deny") return false;

  const selection = await vscode.window.showWarningMessage(
    `Meridian is about to send workspace content to the configured language model provider (${featureLabel}). Continue?`,
    { modal: true },
    "Continue"
  );
  return selection === "Continue";
}

export function sanitizeLmPayload(raw: string): string {
  let sanitized = raw;

  // Common token-like secrets.
  sanitized = sanitized.replace(/\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/g, "[REDACTED_TOKEN]");
  sanitized = sanitized.replace(/\b(?:api[_-]?key|token|secret)\s*[:=]\s*["']?[^\s"']+/gi, "[REDACTED_SECRET]");

  if (sanitized.length > MAX_LM_PAYLOAD_LENGTH) {
    sanitized = `${sanitized.slice(0, MAX_LM_PAYLOAD_LENGTH)}\n\n[TRUNCATED]`;
  }
  return sanitized;
}
