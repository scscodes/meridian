# Meridian — Roadmap

See [FEATURES.md](./FEATURES.md) for the complete feature inventory.

---

## Deferred

- Remote telemetry sink — no destination exists yet
- Additional analytics chart types — diminishing returns on existing webviews
- Webview message typed generics — `BaseWebviewProvider<T, M extends WebviewMessage>` parameterization
---

## Next Focus Areas

- **Integration & E2E coverage (medium criticality)**
  - Add integration tests for webview adapters (analytics panels), exercising `src/infrastructure/webview-provider.ts` and `src/presentation/webview-setup.ts` end-to-end.

- **Error code + telemetry standardization (medium–high criticality)**
  - Align all domain/infrastructure error codes with `src/infrastructure/error-codes.ts` and the `ErrorCode` union; eliminate ad-hoc string literals like `CONFIG_INIT_ERROR`, `CONFIG_SET_ERROR`, `WORKFLOW_INIT_ERROR`, and `STEP_RUNNER_NOT_AVAILABLE`.
  - Primary files: `src/infrastructure/config.ts`, `src/domains/workflow/service.ts`, `src/domains/git/service.ts`, `src/router.ts`, `src/infrastructure/workspace-provider.ts`.

- **Workflow engine robustness (medium criticality)**
  - Implement support for `WorkflowStep.conditions` and explicit retry/timeout semantics using `TIMEOUTS.WORKFLOW_STEP` and `WORKFLOW_ERROR_CODES` (e.g., `STEP_TIMEOUT`, `STEP_EXECUTION_ERROR`), rather than single-shot execution.
  - Ensure integration tests (e.g., `tests/integration.test.ts`) assert the intended behaviour for `retries` and failure paths instead of relying on comments only.
  - Primary files: `src/infrastructure/workflow-engine.ts`, `src/types.ts`, `src/infrastructure/error-codes.ts`, `tests/integration.test.ts`.

- **Config and settings resilience (medium criticality)**
  - Add unit tests for the configuration provider covering initialization failure, `set` failure, and default/fallback behaviour, including prune config round-trips.
  - Primary files: `src/infrastructure/config.ts`, new tests (e.g., `tests/config.test.ts`).

- **Telemetry wiring (medium criticality, low immediate operational risk)**
  - Wire `TelemetryTracker` into the structured logger and command/router boundaries so command start/completion/failure and domain-level errors emit `TelemetryEvent` records.
  - Primary files: `src/infrastructure/telemetry.ts`, `src/infrastructure/logger.ts`, `src/router.ts`, domain services in `src/domains/*/service.ts`.
