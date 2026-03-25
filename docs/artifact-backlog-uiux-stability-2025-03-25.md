# Backlog prioritization — UI/UX and stability

**Generated:** 2025-03-25  
**Scope:** Documentation and ADR-derived backlog (`docs/ROADMAP.md`, `docs/adr/006`, `docs/adr/007`, `tasks/todo.md`). Source code under `src/` and `tests/` contained no `TODO`/`FIXME` markers at generation time.

---

## Sources

| Source | Contents |
|--------|----------|
| `docs/ROADMAP.md` | Deferred items and next focus areas (with criticality notes) |
| `docs/adr/006-rendering-surface-decision-matrix.md` | Known existing non-compliance (migration backlog) |
| `docs/adr/007-workflow-tree-step-expansion.md` | Known limitation (chat-triggered workflow spinner) |
| `tasks/todo.md` | Publish-readiness sprint — all items completed |

---

## Ranked by benefit to UI/UX and stability

Order is **highest combined impact first** (both dimensions noted where they differ).

| Rank | Item | UI/UX | Stability | Notes |
|------|------|-------|-----------|--------|
| **1** | **Chat NL → workflow routing** — inject `workflow.list` (names + descriptions) into the classifier prompt before delegating | **High** — reduces wrong or missing workflow runs from natural language | **Medium** — fewer mis-dispatches and confusion | ROADMAP: medium criticality; primary files: `chat-participant.ts`, `chat/handlers.ts`, `prompt-registry.ts` |
| **2** | **Workflow engine robustness** — `WorkflowStep.conditions`, retries, timeouts (`TIMEOUTS.WORKFLOW_STEP`, `WORKFLOW_ERROR_CODES`); integration tests assert behavior | **Medium** — clearer step outcomes, less opaque failure | **High** — core execution semantics | ROADMAP: medium criticality; `workflow-engine.ts`, `types.ts`, `error-codes.ts`, `tests/integration.test.ts` |
| **3** | **ADR 006 backlog — `hygiene.impactAnalysis` error path** — “Show Output” when diagnostics land in the output channel | **High** on failure paths | **Medium** — consistent error recovery | ROADMAP labels low user impact; still a policy/consistency gap vs ADR 006 |
| **4** | **Integration / E2E tests for webview analytics** — exercise `webview-provider.ts` and `webview-setup.ts` | **Medium** — fewer silent dashboard regressions | **High** — catches breakage in heavy UI paths | ROADMAP: medium criticality |
| **5** | **`workflow.run` spinner on `chat.delegate` path** — pre-execution hook for `setRunning` | **Medium** — parity with panel-triggered runs | Low | ADR 007 known limitation; ROADMAP deferred until broader signaling pattern |
| **6** | **`git.resolveConflicts` → tree expansion** (structured per-file data per ADR 006) | **High** for that workflow | Low | ROADMAP: medium priority, no immediate user impact |
| **7** | **ADR 006 — `hygiene.reviewFile`** — richer surface than output-channel streaming where appropriate | **Medium** | Low | “Last resort” rule; compliance + comfort |
| **8** | **Telemetry wiring** — `TelemetryTracker` at logger and router/command boundaries | Low direct UX | **High** for operational stability and diagnosis | ROADMAP: medium criticality, low immediate operational risk |
| **9** | **Workflow run history webview** — multi-run timeline with per-step history | **High** if shipped | Medium | **Blocked** on webview infrastructure; tree covers single-run case |
| **10** | **Remote telemetry sink** | None | Medium–long term | No destination yet — deferred |
| **11** | **Webview message typed generics** (`BaseWebviewProvider<…>`) | None | Developer safety | Deferred — DX, not user-visible |
| **12** | **Additional analytics chart types** | Low (diminishing returns) | None | Explicitly deferred |

---

## Summary

- **Strongest UX + reliability combo:** NL → workflow list injection (fewer wrong runs) and workflow engine conditions / retries / timeouts with real tests (fewer fragile runs).
- **Strongest “product feels finished” polish:** ADR 006 follow-ups (especially impact-analysis errors and conflict resolution surfacing) and the chat workflow spinner — smaller than engine work but visible.
- **Strongest invisible stability:** E2E webview tests and telemetry wiring — users notice mainly when something breaks in production.

---

## Maintenance

This file is a **point-in-time snapshot**. Prefer updating `docs/ROADMAP.md` and ADRs for authoritative backlog; regenerate or supersede this artifact when priorities shift.
