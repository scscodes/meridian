# Meridian — Roadmap

See [FEATURES.md](./FEATURES.md) for the complete feature inventory.

---

## Deferred

- Remote telemetry sink — no destination exists yet
- Additional analytics chart types — diminishing returns on existing webviews
- Webview message typed generics — `BaseWebviewProvider<T, M extends WebviewMessage>` parameterization
---

## Next Focus Areas

- **Chat NL → workflow routing (medium criticality)**
  - The `chat.delegate` classifier knows the `workflow.run:<name>` dispatch format but has no knowledge of available workspace workflow names at classification time. Users saying "run my deploy pipeline" may get intent mismatches if the workflow name doesn't match.
  - Fix: before delegating NL input, fetch available workflows via `workflow.list` and inject names+descriptions into the classifier prompt context.
  - Primary files: `src/ui/chat-participant.ts`, `src/domains/chat/handlers.ts`, `src/infrastructure/prompt-registry.ts`.

- **Integration & E2E coverage (medium criticality)**
  - Add integration tests for webview adapters (analytics panels), exercising `src/infrastructure/webview-provider.ts` and `src/presentation/webview-setup.ts` end-to-end.

- **Workflow engine robustness (medium criticality)**
  - Implement support for `WorkflowStep.conditions` and explicit retry/timeout semantics using `TIMEOUTS.WORKFLOW_STEP` and `WORKFLOW_ERROR_CODES` (e.g., `STEP_TIMEOUT`, `STEP_EXECUTION_ERROR`), rather than single-shot execution.
  - Ensure integration tests (e.g., `tests/integration.test.ts`) assert the intended behaviour for `retries` and failure paths instead of relying on comments only.
  - Primary files: `src/infrastructure/workflow-engine.ts`, `src/types.ts`, `src/infrastructure/error-codes.ts`, `tests/integration.test.ts`.

- **Telemetry wiring (medium criticality, low immediate operational risk)**
  - Wire `TelemetryTracker` into the structured logger and command/router boundaries so command start/completion/failure and domain-level errors emit `TelemetryEvent` records.
  - Primary files: `src/infrastructure/telemetry.ts`, `src/infrastructure/logger.ts`, `src/router.ts`, domain services in `src/domains/*/service.ts`.
