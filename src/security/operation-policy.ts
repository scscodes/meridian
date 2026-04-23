import * as vscode from "vscode";

type GitNetworkMode = "allow" | "prompt" | "deny";

const MAX_LOG_LENGTH = 4000;

function getSecurityConfig() {
  try {
    const cfg = (vscode as unknown as {
      workspace?: { getConfiguration?: (section: string) => { get<T>(key: string, fallback: T): T } };
    }).workspace?.getConfiguration?.("meridian.security");
    if (cfg) return cfg;
  } catch {
    // Test environments may not include vscode.workspace in mocks.
  }
  return {
    get<T>(_key: string, fallback: T): T {
      return fallback;
    },
  };
}

export function isSensitiveLoggingEnabled(): boolean {
  const mode = getSecurityConfig().get<string>("logging.sensitive", "redact");
  return mode === "allow";
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
  const autoCopy = getSecurityConfig().get<boolean>("clipboard.autoCopy", false);
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

export function getGitNetworkMode(): GitNetworkMode {
  const mode = getSecurityConfig().get<string>("gitNetwork.mode", "prompt");
  return mode === "allow" || mode === "prompt" || mode === "deny" ? mode : "prompt";
}

export function getAllowedGitHosts(): string[] {
  const configured = getSecurityConfig().get<string[]>("gitNetwork.allowedHosts", []);
  return configured.map((h) => h.trim().toLowerCase()).filter(Boolean);
}
