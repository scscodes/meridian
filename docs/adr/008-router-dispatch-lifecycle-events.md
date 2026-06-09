# ADR 008 — Router Dispatch Lifecycle Events

**Status:** Accepted — mechanism present but **dormant** post-2.0 (see Current state)
**Date:** 2026-04-20

## Current state (post-2.0, authoritative — verify before building on this)

The router still **exposes** the lifecycle events — `onBeforeHandler` / `onAfterHandler` (`src/router.ts:88`, `:98`), with `DispatchEvent` / `DispatchCompleteEvent` defined in `src/types.ts:260`, `:265`. The firing semantics below are still accurate.

**However, nothing consumes them.** The dedicated subscriber module `src/presentation/dispatch-signaling.ts` was **deleted** in the 2.0 re-anchor, and there is **zero** remaining `onBeforeHandler` / `onAfterHandler` subscriber and **zero** `setRunning` / `setLastRun` caller anywhere in `src/` (verified). The originating motivation — the `chat.delegate` → `workflow.run` spinner — is void; both commands were removed.

Net for an agent: this is **dormant infrastructure**, not an active spinner pipeline. Do *not* assume dispatching a command produces any UI affordance via this path. Re-activating it requires writing a *new* subscriber (the old `dispatch-signaling.ts` is gone) and wiring it in `main.ts`; the event surface itself needs no change.

## Context

*Historical (pre-2.0), retained because it explains why the event surface has the shape it does:* tree providers exposed `setRunning()`/`setLastRun()` spinner affordances invoked manually at direct dispatch call sites. When a command was dispatched **internally** by another handler (e.g. `chat.delegate` dispatching `workflow.run`), the outer call site had no way to signal the tree before the inner dispatch completed.

The general, still-valid problem the mechanism solves: every dispatch path — direct, internal, or future — should be able to emit "about to run handler" and "handler finished" signals that UI surfaces can subscribe to, **without** modifying handlers, the `Middleware` interface, or call sites. That generality is why the event surface was kept in 2.0 even though its only consumer was removed.

## Decision

`CommandRouter` exposes two lifecycle events:

- `onBeforeHandler: Event<DispatchEvent>` — fires after the middleware chain succeeds, before the handler runs.
- `onAfterHandler: Event<DispatchCompleteEvent>` — fires after the handler returns (success) or throws (failure).

Neither fires if the middleware chain rejects. *(Pre-2.0 a presentation module `src/presentation/dispatch-signaling.ts` subscribed to these events and routed to tree spinner methods; that module was deleted in the 2.0 re-anchor — see Current state. The event contract on the router is unchanged.)*

`Event<T>` and `Disposable` are defined in `src/types.ts` as lightweight interfaces matching `vscode.Event<T>` shape, so the router stays free of vscode imports.

## Alternatives Considered

1. **Extend the `Middleware` type.** Would cascade signature changes to all four existing middleware factories (`createObservabilityMiddleware`, `createAuditMiddleware`, `createPermissionMiddleware`, `createRateLimitMiddleware`) and their tests. Higher blast radius, no additional capability.
2. **Pass an event bus into handler context.** Leaks a UI concern into the domain layer, violating DDD boundary (ADR 001).
3. **Refactor `chat.delegate` to return routing decisions and let the caller dispatch.** Breaks `chat.delegate`'s job (classify + dispatch) and still doesn't cover other future internal dispatches.
4. **Use `vscode.EventEmitter` directly in router.** Couples the router to vscode. The router is currently vscode-free and unit-tested without a vscode mock — worth preserving.

## Consequences

- Zero change to domain handlers, `Middleware` type, or existing middleware factories.
- Every dispatch path emits lifecycle events, regardless of origin (direct, or internally/nested-dispatched by another handler).
- New UI surfaces subscribe without touching router or handlers.
- Listeners are synchronous `(e: T) => void`. Listener exceptions are caught per-listener, logged, and swallowed — dispatch never breaks because of a misbehaving listener. *(This guarantee matters for any future subscriber — it is currently exercised by none.)*
- `DispatchEvent.context` is `MiddlewareContext`, which carries `runId` (run-log correlation). A future subscriber gains it automatically — no event-shape change needed.

## Firing Semantics

| Scenario | onBeforeHandler | onAfterHandler |
|---|---|---|
| Middleware chain succeeds, handler returns ok | fires | fires (result.kind === "ok") |
| Middleware chain succeeds, handler throws | fires | fires (result.kind === "err", HANDLER_ERROR) |
| Middleware chain rejects | does not fire | does not fire |
| Handler not registered | does not fire | does not fire |
