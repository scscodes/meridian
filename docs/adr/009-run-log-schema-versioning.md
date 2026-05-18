# ADR 009 — Run Log Schema and Versioning Policy

**Status:** Accepted (revised)
**Date:** 2026-04-20

> **Revised by [ADR 012](./012-product-reanchor.md) (2026-05-18):** the run log now serves the computed-insight / session-briefing surface, not skill discoverability or an AI layer. The router still emits events for git/hygiene dispatches. The `source` enum members `workflow`/`agent`/`skill` are permanently unused but **retained** — the schema version is deliberately **not** bumped (stability over cosmetic trimming).

## Context

Foundation #1 in the roadmap requires a stable substrate for execution history before any UI consumption. Upcoming work (session briefing aggregation, workflow run history, and skill discoverability) depends on a shared, deterministic event source with correlation across router dispatches and nested command execution.

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

