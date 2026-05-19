# ADR 004 — GenerateProseFn Dependency Injection

**Date**: 2026-03-04
**Status**: Accepted — pattern current, scope narrowed by [ADR 012](./012-product-reanchor.md)

## Current state (post-2.0, authoritative)

The injection pattern is live and unchanged. Only its scope narrowed.

- **Type:** `GenerateProseFn` is defined in **`src/types.ts:244`**, *not* the deleted `chat` domain. Exact shape:
  `(request: { domain: "hygiene" | "git"; systemPrompt: string; data: Record<string, unknown> }) => Promise<Result<string>>`.
  The `domain` discriminant being exactly `"hygiene" | "git"` is the type-level encoding of the two surviving consumers — keep it that narrow.
- **Concrete impl:** `generateProse` in `src/infrastructure/prose-generator.ts:19`, which uses its own input interface `ProseRequest` (`prose-generator.ts:12`). `ProseRequest` is the implementation's type, *not* the injected contract — do not conflate them; handlers depend only on `GenerateProseFn`.
- **The two and only consumers:** `git.sessionBriefing` (`src/domains/git/session-handler.ts`) and `hygiene.impactAnalysis` (`src/domains/hygiene/impact-analysis-handler.ts`). The latter degrades to the raw computed analysis when `vscode.lm` is unavailable.
- **Removed in 2.0 (do not re-add prose to these):** PR generation/review/comment, conflict resolution, smart-commit messages, NL classification — the entire `chat` domain and LM-tool surface.

---

## Context

Prose generation (PR descriptions, briefings, review summaries) requires `vscode.lm` — a VS Code runtime API. Domain handlers need this capability but cannot import VS Code APIs directly: doing so couples them to the extension host, makes them untestable in a plain Node/Vitest environment, and violates the layer boundary between domain logic and infrastructure.

---

## Decision

Prose generation is injected as `GenerateProseFn` — the typed async function defined in `src/types.ts:244` (signature above). Handlers declare the dependency in their constructor or factory signature. The concrete implementation (`generateProse` in `src/infrastructure/prose-generator.ts`) is wired at startup in `main.ts`.

Domain handlers have zero `import * as vscode` statements for LLM access. If a handler needs prose, it receives `generateProseFn` as a parameter — not an import.

---

## Consequences

**Good:**
- Tests pass a mock `generateProseFn` returning a fixed string — no VS Code runtime, no network.
- LLM backend changes (model swap, API version, token limits) are isolated to `prose-generator.ts`.
- Domain handlers remain pure functions over their injected dependencies.

**Watch out:**
- Do not import `generateProse` directly inside a domain handler, even if it seems convenient. This breaks the isolation guarantee and silently re-couples the handler to the VS Code runtime.
- `GenerateProseFn` (`src/types.ts:244`) is the stable API surface for handlers — changes to it require updating both consumers. Keep its `domain` union exactly `"hygiene" | "git"`; widening it invites prose paths 2.0 deliberately removed.
- Wiring happens in `main.ts`. If a new handler needs prose, add the injection there — don't let handlers source it themselves.

---

## Reference

- `src/types.ts:244` — `GenerateProseFn` type definition (canonical injected contract)
- `src/infrastructure/prose-generator.ts` — concrete `generateProse` impl + its `ProseRequest` input type
- `src/domains/git/session-handler.ts`, `src/domains/hygiene/impact-analysis-handler.ts` — the two consumers
- `src/main.ts` — dependency wiring at startup
