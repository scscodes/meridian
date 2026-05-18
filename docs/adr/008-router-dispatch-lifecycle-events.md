# ADR 008 — Router Dispatch Lifecycle Events

**Status:** Accepted (revised)
**Date:** 2026-04-20

> **Revised by [ADR 012](./012-product-reanchor.md) (2026-05-18):** the originating motivation (the `chat.delegate` → `workflow.run` spinner) is void — both are removed. The lifecycle mechanism is retained: it still drives the `gitTree` spinner on direct dispatch.

## Context

Tree providers (`WorkflowTreeProvider`, `GitTreeProvider`) expose `setRunning()`/`setLastRun()` methods that drive spinner affordances. These are invoked manually at direct dispatch call sites (`src/presentation/specialized-commands.ts`, `src/ui/chat-participant.ts`). When a command is dispatched **internally** by another handler — e.g., `chat.delegate` dispatching `workflow.run` — the outer call site has no way to signal the tree before the inner dispatch completes. ADR 007 deferred the `chat.delegate` → `workflow.run` spinner for exactly this reason.

We need a mechanism that makes every dispatch path — current and future — emit "about to run handler" and "handler finished" signals that UI surfaces subscribe to, without modifying handlers, the `Middleware` interface, or existing call sites.

## Decision

`CommandRouter` exposes two lifecycle events:

- `onBeforeHandler: Event<DispatchEvent>` — fires after the middleware chain succeeds, before the handler runs.
- `onAfterHandler: Event<DispatchCompleteEvent>` — fires after the handler returns (success) or throws (failure).

Neither fires if the middleware chain rejects. A new presentation module `src/presentation/dispatch-signaling.ts` subscribes to these events and routes to the existing tree methods.

`Event<T>` and `Disposable` are defined in `src/types.ts` as lightweight interfaces matching `vscode.Event<T>` shape, so the router stays free of vscode imports.

## Alternatives Considered

1. **Extend the `Middleware` type.** Would cascade signature changes to all four existing middleware factories (`createObservabilityMiddleware`, `createAuditMiddleware`, `createPermissionMiddleware`, `createRateLimitMiddleware`) and their tests. Higher blast radius, no additional capability.
2. **Pass an event bus into handler context.** Leaks a UI concern into the domain layer, violating DDD boundary (ADR 001).
3. **Refactor `chat.delegate` to return routing decisions and let the caller dispatch.** Breaks `chat.delegate`'s job (classify + dispatch) and still doesn't cover other future internal dispatches.
4. **Use `vscode.EventEmitter` directly in router.** Couples the router to vscode. The router is currently vscode-free and unit-tested without a vscode mock — worth preserving.

## Consequences

- Zero change to domain handlers, `Middleware` type, or existing middleware factories.
- Every dispatch path emits lifecycle events, regardless of origin (direct, chat-delegated, LM-tool, future).
- New UI surfaces subscribe without touching router or handlers.
- Listeners are synchronous `(e: T) => void`. Listener exceptions are caught per-listener, logged, and swallowed — dispatch never breaks because of a misbehaving listener.
- Existing manual `setRunning`/`setLastRun` calls in `specialized-commands.ts` and `chat-participant.ts` remain; they are idempotent and harmless alongside the new hook. A future cleanup can remove them once the hook has soaked.
- `DispatchEvent.context` is `MiddlewareContext`. When Foundation #1 (run event log) adds `runId` to `MiddlewareContext`, consumers gain it automatically — no event-shape change needed.

## Firing Semantics

| Scenario | onBeforeHandler | onAfterHandler |
|---|---|---|
| Middleware chain succeeds, handler returns ok | fires | fires (result.kind === "ok") |
| Middleware chain succeeds, handler throws | fires | fires (result.kind === "err", HANDLER_ERROR) |
| Middleware chain rejects | does not fire | does not fire |
| Handler not registered | does not fire | does not fire |
