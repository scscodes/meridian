# ADR 005 — Parameterized Commands Require Dedicated main.ts Registration

**Date**: 2026-03-04
**Status**: Accepted

---

## Context

Most commands are registered via the `COMMAND_MAP` loop in `main.ts`, which dispatches with empty params `{}`. This is correct for commands that derive all inputs from `CommandContext` (git state, workspace root, file system). It silently breaks for commands that require runtime user input: the handler receives `{}`, fails param validation with `INVALID_PARAMS`, and shows a cryptic error with no hint that the registration is the cause.

---

## Decision

Any command that requires params beyond what `CommandContext` provides must have a dedicated `vscode.commands.registerCommand` call in `main.ts`. That registration is responsible for:

1. Reading the active editor path (or other ambient context)
2. Prompting the user via `InputBox` or `QuickPick`
3. Constructing the full params object before calling `router.dispatch()`

Do NOT add such a command to `COMMAND_MAP`. Add a comment in `COMMAND_MAP` noting that a dedicated registration exists and why.

**Current example**: `hygiene.impactAnalysis` — needs `filePath` (active editor) and optional `functionName` (InputBox). Adding it to `COMMAND_MAP` would dispatch `{}` and fail every time.

**Rule of thumb**: If the handler's param validation would reject `{}`, it needs dedicated registration.

---

## Consequences

**Good:**
- Silent `INVALID_PARAMS` failures at runtime are eliminated for parameterized commands.
- Registration intent is explicit and reviewable in one place (`main.ts`).

**Watch out:**
- Dedicated registrations are more boilerplate. That cost is intentional — it forces the author to think about param sourcing explicitly rather than discovering the failure at runtime.
- The comment in `COMMAND_MAP` is mandatory. Without it, future maintainers will add the command to the loop and reintroduce the silent failure.

---

## Reference

- `src/main.ts` — `COMMAND_MAP` loop and dedicated `hygiene.impactAnalysis` registration
- `src/domains/hygiene/impact-analysis-handler.ts` — param validation that requires `filePath`
