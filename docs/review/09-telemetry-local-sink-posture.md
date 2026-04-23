# Topic 09 — Telemetry Posture (Current Local-Only Evidence)

## Observation

Telemetry implementation appears local-sink only in current repository state.

## Evidence

- `src/main.ts`
  - L74: `new TelemetryTracker(new ConsoleTelemetrySink(false))`.
- `src/infrastructure/telemetry.ts`
  - L474: `InMemoryTelemetrySink`.
  - L546: `ConsoleTelemetrySink`.
- `docs/ROADMAP.md`
  - L48: `Remote telemetry sink — no destination exists`.

## Scope / Residual Risk

- No direct remote telemetry sink is evidenced in current code.
- This posture can change quickly if future sinks are added; should be tracked explicitly in review controls.

## Suggested Control

- Add a policy check/test that fails if remote telemetry endpoints/sinks are introduced without approval updates.
