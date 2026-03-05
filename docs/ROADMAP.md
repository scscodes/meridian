# Meridian — Roadmap

See [FEATURES.md](./FEATURES.md) for the complete feature inventory.

---

## Completed Phases

- **Chat NL-First Refactor** — `@meridian` routes all NL via LLM classifier (prompt registry: `DELEGATE_CLASSIFIER`), 16 LM tools for Copilot agent mode, `RESULT_FORMATTERS` map for extensible output, full command parity via chat.

---

## Deferred

- Canonical config service — unify direct `vscode.workspace.getConfiguration` calls into a single provider
- Remote telemetry sink — no destination exists yet
- Additional analytics chart types — diminishing returns on existing webviews
- Background task scheduling — periodic hygiene scans
