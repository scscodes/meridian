# ADR 002 — Result Monad over throw/catch

**Date**: 2026-03-04
**Status**: Accepted

---

## Context

Domain handlers are async, deeply nested, and invoked from multiple surfaces: chat participant, command palette, LM tools, and keybindings. Exceptions thrown inside handlers can be swallowed silently by VS Code's event loop or by call sites that omit try/catch. Silent failures produce no error telemetry and no user feedback.

---

## Decision

All domain handlers return `Result<T>` — `{kind: "ok", value: T} | {kind: "err", error: AppError}`. No throwing in normal flow.

Infrastructure boundaries that throw (TypeScript compiler API, `execSync`, VS Code APIs) are caught at the handler boundary and converted to `Result` before propagating.

`success()` and `failure()` in `src/types.ts` are the **only** constructors for Result values. Do not construct `{kind: "ok", ...}` literals inline.

---

## Consequences

**Good:**
- Every call site is forced to handle both paths explicitly.
- Errors carry structured context (`code`, `message`, `context` field) — no stringly-typed catch blocks.
- Handlers are testable without try/catch harnesses.
- Telemetry middleware inspects all outcomes uniformly via `result.kind`.

**Watch out:**
- Infrastructure helpers that throw must be wrapped at the handler boundary — not buried deeper. Wrapping deep inside a utility hides the error origin.
- Do not add `throws` to handler signatures. If you need to signal failure, return `failure(...)`.
- Third-party async calls should be wrapped in a try/catch that returns `failure()` — never `await` them naked inside a handler.

---

## Reference

- `src/types.ts` — `Result<T>`, `AppError`, `success()`, `failure()`
- `src/router.ts` — middleware chain that inspects `Result`
