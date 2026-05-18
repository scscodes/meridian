# ADR 004 — GenerateProseFn Dependency Injection

**Date**: 2026-03-04
**Status**: Accepted (scope narrowed)

> **Revised by [ADR 012](./012-product-reanchor.md) (2026-05-18):** the surviving `GenerateProseFn` consumers are `git.sessionBriefing` and `hygiene.impactAnalysis` (the latter optional — it degrades to the raw analysis when no model is available). All other prose paths (PR generation/review/comment, conflict resolution, smart-commit messages, NL classification) were removed. The injection pattern stands; its scope is now two handlers.

---

## Context

Prose generation (PR descriptions, briefings, review summaries) requires `vscode.lm` — a VS Code runtime API. Domain handlers need this capability but cannot import VS Code APIs directly: doing so couples them to the extension host, makes them untestable in a plain Node/Vitest environment, and violates the layer boundary between domain logic and infrastructure.

---

## Decision

Prose generation is injected as `GenerateProseFn` — a typed async function `(req: ProseRequest) => Promise<Result<string>>`. Handlers declare the dependency in their constructor or factory signature. The concrete implementation (`generateProse` in `src/infrastructure/prose-generator.ts`) is wired at startup in `main.ts`.

Domain handlers have zero `import * as vscode` statements for LLM access. If a handler needs prose, it receives `generateProseFn` as a parameter — not an import.

---

## Consequences

**Good:**
- Tests pass a mock `generateProseFn` returning a fixed string — no VS Code runtime, no network.
- LLM backend changes (model swap, API version, token limits) are isolated to `prose-generator.ts`.
- Domain handlers remain pure functions over their injected dependencies.

**Watch out:**
- Do not import `generateProse` directly inside a domain handler, even if it seems convenient. This breaks the isolation guarantee and silently re-couples the handler to the VS Code runtime.
- `ProseRequest` and `GenerateProseFn` are the stable API surface — changes to the type require updating all handlers that consume it. Keep the type narrow.
- Wiring happens in `main.ts`. If a new handler needs prose, add the injection there — don't let handlers source it themselves.

---

## Reference

- `src/infrastructure/prose-generator.ts` — concrete implementation
- `src/domains/chat/handlers.ts` — `GenerateProseFn` type definition
- `src/main.ts` — dependency wiring at startup
