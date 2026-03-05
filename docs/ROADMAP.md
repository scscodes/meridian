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

## Next Focus Areas

- **Hygiene & background scanning**
  - Finish wiring periodic hygiene scans in `HygieneDomainService` (real interval scheduling and teardown).
  - Surface workspace traversal failures in `WorkspaceProvider` via injected logging instead of swallowing errors.
  - Harden hygiene impact analysis and `/impact` UX (types, error paths, and integration with chat).

- **Architecture & DI (prose, config)**
  - Complete DI for `GenerateProseFn` across domains (git, chat, hygiene) so no domain imports VS Code/LM directly.
  - Converge on a canonical `ConfigProvider` for all extension configuration (hygiene scheduling, prune behavior, model selection, log level).

- **Types & Result usage**
  - Replace `any` and `as any` in handler maps, Git/hygiene params, presenters, and webview message handling with small, local types.
  - Align workflow/infra error codes with `Result` + `error-codes` (use `success`/`failure` helpers, centralize codes).

- **NL-first routing & command catalog**
  - Keep `chat.delegate`, LM tools, and workflows aligned with ADR 003 (single classifier).
  - Ensure `KNOWN_COMMANDS`, LM `TOOL_DEFS`, and classifier prompt text are synchronized or generated from a single catalog.
  - Codify chat routing precedence (slash commands, `run <name>`, delegate) in tests.

- **UI, LM tools, and integration tests**
  - Add tests around `chat-participant`, LM tools registration/behavior, and webview adapters.
  - Ensure LM tools respect the same `Result` formatting and error UX as the rest of the extension.

- **Documentation cleanup**
  - Retire or fold legacy structural-refactor docs into `ARCHITECTURE.md` / ADRs.
  - Add a concise “NL orchestration” section describing how chat, LM tools, workflows, and agents compose.

## Proposed Iterations

- **Iteration 1 — Stabilization**
  - Finish hygiene background scheduling and logging.
  - Tighten types around hygiene/git handler maps and impact analysis.
  - Add `/impact` + ImpactAnalyzer tests.

- **Iteration 2 — Architecture hardening**
  - Complete `GenerateProseFn` DI and wire the canonical `ConfigProvider`.
  - Align Result/error-code usage for workflow + infra and extend formatter tests.

- **Iteration 3 — NL-first & UX**
  - Add tests for chat participant and LM tools; enforce sync between command catalog and classifier prompt.
  - Document NL orchestration and retire remaining structural-refactor migration docs.
