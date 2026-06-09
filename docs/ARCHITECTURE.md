# Architecture

Structural overview for contributors. For *what* Meridian does, see [FEATURES.md](./FEATURES.md);
for *why* a given decision was made, see the [ADRs](./adr/). This file covers layers, the core
patterns, extension points, and a file map — it does not duplicate the code.

## Shape

Meridian is a single VS Code extension (TypeScript, compiled to `out/`). Everything flows through a
**CommandRouter** that dispatches a command id to a domain **handler**; handlers return a
`Result<T>` (never throw across the boundary); a **presenter** renders the result onto the surface
chosen by output shape and trigger. Computation is deterministic — language-model calls are optional
prose on top of an already-complete aggregate, never the source of truth.

```
VS Code (commands · views · webviews · chat · LM tools)
        │
  presentation/         command registration, watchers, presenters, status bar, trees, webview wiring
        │
  router.ts             CommandRouter: middleware chain → handler dispatch → Result
        │
  domains/              git · hygiene — handlers + services (the actual work)
        │
  infrastructure/       git-provider, workspace, settings, run-log, telemetry, caches, prose, webview host
  security/             path-guard, ignore-store, lm-policy, operation-policy (boundary enforcement)
  cross-cutting/        middleware
```

## Layers

- **`src/presentation/`** — the VS Code-facing edge. `command-registry.ts` registers commands;
  `result-presenters.ts` renders a `Result` to the correct surface; `tree-setup.ts` / `webview-setup.ts`
  wire views; `file-watchers.ts` and `status-bar.ts` handle ambient UI. Knows about VS Code APIs;
  contains no domain logic.
- **`router.ts`** — `CommandRouter.dispatch()` runs a registered middleware chain, then invokes the
  handler for the command id. Lifecycle events emitted here (ADR 008). The single dispatch chokepoint.
- **`src/domains/`** — the work. Two domains today: **`git/`** (status, commits, analytics,
  change-coupling, session briefing aggregator) and **`hygiene/`** (scan, dead-code/impact analysis,
  cleanup, collections). Each exposes handlers (thin) over services (logic) and its own `types.ts`.
  Webview assets live beside their domain (`analytics-ui/`, `session-briefing-ui/`).
- **`src/infrastructure/`** — capabilities domains depend on: `git-provider.ts` (the only place that
  shells git), `workspace.ts` / `workspace-provider.ts`, `settings.ts` (the single `readSetting`
  chokepoint, ADR 013), `run-log.ts` (append-only JSONL event log, ADR 009), `telemetry.ts`,
  `cache.ts`, `prose-generator.ts` (injected LM prose, ADR 004), `webview-provider.ts`.
- **`src/security/`** — boundary enforcement: `path-guard.ts` (no escaping the workspace),
  `ignore-store.ts` (`.meridian/` ignore semantics, ADR 015), `lm-policy.ts` / `operation-policy.ts`
  (redaction + network posture; both sanitize secrets at source).
- **`src/cross-cutting/`** — `middleware.ts`, the chain the router runs before dispatch.

## Core patterns

- **Result monad (ADR 002).** Every handler/service returns `Result<T>` = `success(value)` |
  `failure(AppError)`. No throwing across layers; errors carry codes from
  `infrastructure/error-codes.ts`. Defined in `src/types.ts`.
- **CommandRouter dispatch (ADR 005, 008).** Commands register through the router; parameterized
  commands get dedicated `main.ts` registration. Dispatch emits lifecycle events consumed by signaling.
- **Rendering surface by shape × trigger (ADR 006).** A result's output shape and how it was
  triggered pick the surface (notification, tree, webview, chat). Presenters never hard-code surface
  per command.
- **Prose by injection (ADR 004).** Where natural-language summary helps, a `GenerateProseFn` is
  injected; the deterministic aggregate stands alone if no model is available.
- **Single settings chokepoint (ADR 013).** All config reads go through `readSetting()`; enums are
  narrowed at the policy boundary because VS Code does not enforce enum membership at runtime.
- **Aggregator/reader pattern (ADR 011).** The session briefing reads existing substrates (git state,
  run-log, analytics, hygiene) into one `SessionBriefing` rather than recomputing — additive slices only.

## Extension points

- **New command** → register in `presentation/command-registry.ts` (or `main.ts` if parameterized),
  add a handler in the owning domain, and list it in `FEATURES.md` (ADR 001 rule 3). Manifest parity
  is checked by `tests/manifest.test.ts`.
- **New domain** → add `src/domains/<name>/` with `index.ts`, handlers, service, `types.ts`; update
  this file (ADR 001 rule 4).
- **New surface/webview** → assets beside the domain; host via `infrastructure/webview-provider.ts`;
  wire in `presentation/webview-setup.ts`.
- **New LM tool** → JSON `LmToolEnvelope` (ADR 010), wired in `src/ui/`.

## File map (top level)

| Path | Role |
|------|------|
| `src/main.ts` | Activation; builds the router, registers commands/views/providers |
| `src/router.ts` | `CommandRouter` — middleware + dispatch |
| `src/types.ts` | `Result<T>`, core domain/provider interfaces |
| `src/constants.ts`, `src/report-labels.ts` | Shared constants and presentation labels |
| `src/domains/git/`, `src/domains/hygiene/` | The two feature domains |
| `src/infrastructure/` | Providers, settings, run-log, telemetry, caches, prose, webview host |
| `src/security/` | Path/ignore/LM/operation policy |
| `src/presentation/`, `src/ui/` | Command/view/webview wiring, presenters, status bar, LM tools |
| `tests/` | Vitest suites, co-located by concern; `manifest.test.ts` pins package.json parity |
| `docs/adr/` | Architectural decision records (rationale) |

## Decision records

ADRs 001–017 under [`docs/adr/`](./adr/) capture rationale: docs convention (001), Result monad
(002), single NL classifier (003), prose injection (004), command registration (005), rendering
matrix (006), workflow tree expansion (007), router lifecycle events (008), run-log schema (009),
LM tool envelope (010), session briefing aggregator (011), product re-anchor (012), settings doctrine
(013), dotdir doctrine (014), ignore semantics (015), host-portable UI affordances (016), and
extension publishing (017).
