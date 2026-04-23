import * as vscode from "vscode";

type LmEgressMode = "allow" | "prompt" | "deny";

const MAX_LM_PAYLOAD_LENGTH = 12000;

function getLmEgressMode(): LmEgressMode {
  const mode = vscode.workspace
    .getConfiguration("meridian.security")
    .get<string>("lmEgress.mode", "prompt");
  return mode === "allow" || mode === "prompt" || mode === "deny" ? mode : "prompt";
}

export async function enforceLmEgressPolicy(featureLabel: string): Promise<boolean> {
  const mode = getLmEgressMode();
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
