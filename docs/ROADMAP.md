# Meridian — Roadmap

See [FEATURES.md](./FEATURES.md) for the complete feature inventory.

---

## Completed Phases

- **Chat NL-First Refactor** — `@meridian` routes all NL via LLM classifier (prompt registry: `DELEGATE_CLASSIFIER`), 16 LM tools for Copilot agent mode, `RESULT_FORMATTERS` map for extensible output, full command parity via chat.

- **Stabilization & Architecture Hardening (Iterations 1–3)**
  - Hygiene background scheduling wired (`setInterval`/`clearInterval` in `HygieneDomainService`).
  - Workspace traversal failures surfaced via injected `Logger`.
  - `BaseWebviewProvider.handleMessage` abstract signature typed (no more `any`).
  - Handler maps use `Handler<any, any>` — eliminates all `as Handler` casts.
  - `result-handler`, `result-presenters`, and `chat-participant` formatters use typed domain shapes.
  - `GenerateProseFn` centralized in `src/types.ts`; injected into `createImpactAnalysisHandler`.
  - `Config.initialize()` reads all `meridian.*` VS Code settings; wired in `main.ts`.
  - `git.analyzeInbound` added to `COMMAND_MAP`.
  - 23 new tests: chat-participant 4-tier routing (13), LM tools registration/invocation (10).
  - NL Orchestration section added to `ARCHITECTURE.md`.

- **Command Catalog & Result Alignment**
  - `src/infrastructure/command-catalog.ts` — single source of truth for all commands. `KNOWN_COMMAND_NAMES`, `LM_TOOL_DEFS`, and `buildClassifierLines()` all derived from it; adding a command now requires one entry in one place.
  - `workflow.list` and `agent.list` added as LM tools (16 → 18); intentional exclusions (`git.pull`, `hygiene.cleanup` destructive; `hygiene.showAnalytics` webview-only) documented inline.
  - `DELEGATE_CLASSIFIER` prompt text generated from catalog — can no longer drift.
  - `result-handler` `ERROR_MESSAGES` aligned with actual error codes emitted by workflow/agent handlers; stale `WORKFLOW_EXECUTION_ERROR` entry replaced.
  - Dead `workflow.run` `success === false` formatter branch removed.
  - `agent.execute` gets a real formatter in both `result-handler.ts` and `chat-participant.ts` (was falling to generic `[commandName] OK`).
  - `workflow.list` and `agent.list` get proper chat formatters (bulleted lists) replacing raw JSON dump.
  - 6 new result-handler tests; lm-tools count assertion driven by `LM_TOOL_DEFS.length`.

---

## Deferred

- Remote telemetry sink — no destination exists yet
- Additional analytics chart types — diminishing returns on existing webviews
- Webview message typed generics — `BaseWebviewProvider<T, M extends WebviewMessage>` parameterization

---

## Next Focus Areas

- **Integration & E2E coverage**
  - Add integration tests for webview adapters (analytics panels).
  - Add `/impact` + `ImpactAnalyzer` unit tests (currently untested path).

- **Package & publish readiness**
  - Audit `package.json` `contributes.languageModelTools` against `LM_TOOL_DEFS` (2 new tools need entries: `workflow.list`, `agent.list`).
  - Review `activationEvents` and `engines.vscode` for compatibility range.
