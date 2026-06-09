# ADR 009 — Run Log Schema and Versioning Policy

**Status:** Accepted — schema current, consumer/role narrowed by [ADR 012](./012-product-reanchor.md)
**Date:** 2026-04-20

## Current state (post-2.0, authoritative — code-verified)

- **Role:** the run log serves the computed-insight / session-briefing surface. It is *not* a skill-discoverability or AI substrate (that framing is void). The router feeds it for every git/hygiene dispatch.
- **`source` enum (`RunEventSource`, `src/types.ts:277`) is exactly `"router" | "workflow" | "skill"`.** There is **no `agent` member** — do not introduce one; any earlier prose naming `agent` was inaccurate. Post-2.0 the only value ever emitted is `"router"`; `"workflow"` and `"skill"` are inert members retained for schema stability.
- **`RecentRunEntry.workflowName` / `skillName` are always `undefined`** post-2.0. Inert, retained for ADR 011 wire compatibility. Do not build new logic on either field.
- **Schema version is deliberately NOT bumped** for this narrowing — removing inert members would force a V1→V2 migration of the version-pinned on-disk log for cosmetic gain (exactly the fragility the Version Policy below exists to prevent). Documented intent: if/when the schema bumps for a *substantive* reason (e.g. an expanded session-briefing payload), the inert members ride that increment out — not as a standalone change.

## Context

Foundation #1 in the roadmap required a stable substrate for execution history before any UI consumption. The surviving consumer is session-briefing aggregation (ADR 011), which depends on a shared, deterministic event source with correlation across router dispatches and nested command execution. *(The original motivation also cited workflow run history and skill discoverability; both were removed in the 2.0 re-anchor — the substrate's value is now solely the briefing.)*

Prior to this ADR, execution information existed only in transient logger output and command return payloads, which made cross-surface history reconstruction brittle and hard to evolve.

## Decision

Introduce a versioned append-only run log with a single schema family:

- `RunEventV1` with required envelope fields:
  - `schemaVersion`, `eventId`, `runId`, `timestampMs`, `source`, `phase`
- Allowed phases:
  - `start`, `step`, `complete`, `fail`
- Allowed sources:
  - `router`, `workflow`, `skill`
- Correlation fields:
  - `runId` (current execution), optional `parentRunId` (nested execution lineage)
- Context fields for downstream consumers:
  - `commandName`, `workflowName`, `skillName`, `stepId`, `attempts`, `timedOut`, `durationMs`, `resultKind`, `errorCode`, `errorMessage`

Storage is a workspace-scoped JSONL file (`.vscode/meridian/run-log.v1.jsonl`) written through a single infrastructure module (`src/infrastructure/run-log.ts`), with append-only APIs only.

Phase-specific constraints:

- `start`: no terminal status fields required.
- `step`: requires `stepId` and `resultKind`.
- `complete`: requires `resultKind = "ok"`.
- `fail`: requires `resultKind = "err"`, `errorCode`, and `errorMessage`.

## Version Policy

- V1 records use `schemaVersion = 1`.
- Compatibility is explicit through `isSupportedRunEventVersion(version)`.
- Unknown schema versions are rejected during append/read with typed infrastructure errors.
- UI consumers must gate reads by schema support; they must not silently coerce unknown versions.

## Consequences

- Foundations and content surfaces can share one canonical execution history contract.
- Nested dispatches (`parentRunId`) can be reconstructed without coupling UI to domain internals.
- Run log write/read failures are non-fatal to command execution, but are surfaced via typed errors and warnings.
- No VS Code API coupling is introduced into router internals.
- Router middleware rejections remain non-emitting for run log lifecycle events (no synthetic pre-handler run event).

## Alternatives Considered

1. **Unversioned ad-hoc JSON records**  
   Rejected: high migration risk and consumer fragility.

2. **In-memory only event sink**  
   Rejected: no durability for session-level features and no replayability.

3. **Direct UI-owned event state**  
   Rejected: violates foundation-first roadmap sequencing and increases coupling.

