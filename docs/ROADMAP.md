# Meridian — Roadmap

See [FEATURES.md](./FEATURES.md) for the complete feature inventory.

---

## Completed Phases

- **Chat NL-First Refactor** — `@meridian` routes all NL via LLM classifier (prompt registry: `DELEGATE_CLASSIFIER`), 16 LM tools for Copilot agent mode, `RESULT_FORMATTERS` map for extensible output, full command parity via chat.

- **Stabilization & Architecture Hardening (Iterations 1–3)**
  - Hygiene background scheduling: `setInterval`/`clearInterval` wired in `HygieneDomainService`; starts only when `hygiene.enabled`.
  - Workspace traversal failures surfaced via injected `Logger` instead of swallowed.
  - `BaseWebviewProvider.handleMessage` abstract signature typed (no more `any`).
  - Handler maps use `Handler<any, any>` in service classes — eliminates all `as Handler` casts.
  - `result-handler`, `result-presenters`, and `chat-participant` formatters use typed domain shapes (no `as any`).
  - `GenerateProseFn` centralized in `src/types.ts`; re-exported from original locations; injected into `createImpactAnalysisHandler`.
  - `Config.initialize()` reads all `meridian.*` VS Code settings; `Config.getPruneConfig()` replaces inline `readPruneConfig()`; wired in `main.ts`.
  - `git.analyzeInbound` added to `COMMAND_MAP` (was missing despite being in `TOOL_DEFS`).
  - 23 new tests: chat-participant 4-tier routing (13), LM tools registration/invocation (10).
  - NL Orchestration section added to `ARCHITECTURE.md`; `STRUCTURAL_REFACTOR.md` retired.

---

## Deferred

- Remote telemetry sink — no destination exists yet
- Additional analytics chart types — diminishing returns on existing webviews
- Webview message typed generics — `BaseWebviewProvider<T, M extends WebviewMessage>` parameterization

---

## Next Focus Areas

- **Command catalog synchronization**
  - Ensure `KNOWN_COMMANDS`, LM `TOOL_DEFS`, and the `DELEGATE_CLASSIFIER` prompt text stay synchronized (or generate from a single source of truth).
  - Consider a build-time check that flags drift between the three.

- **Workflow & agent result alignment**
  - Align workflow/infra error codes with `Result` + `error-codes` (use `success`/`failure` helpers, centralize codes).
  - Extend formatter tests to cover workflow step outputs and agent execution results.

- **Integration & E2E coverage**
  - Add integration tests for webview adapters (analytics panels).
  - Add `/impact` + `ImpactAnalyzer` unit tests (currently untested path).
