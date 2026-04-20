# ADR 011 — Session Briefing Aggregator: Cross-Domain Reader Pattern

**Date:** 2026-04-20
**Status:** Accepted
**Depends on:** ADR 009 (run log), ADR 008 (dispatch signaling)

## Context

The `git.sessionBriefing` handler already owned session state aggregation, but its scope was limited to git working-tree data (status, recent commits, uncommitted changes). Foundation #1 (ADR 009) introduced the run log and #3 (ADR 010) standardized LM tool output. The roadmap item #4 called for a richer `SessionBriefing` record that combines all three operational sources: git state, workflow/skill execution history, and workspace hygiene state.

The aggregation logic needed to be separated from the prose-generation step so the same record can feed the webview, chat participant, LM tools, and future surfaces (#5, #7, #8) without each surface re-fetching raw data independently.

## Decision

Introduce `aggregateSessionBriefing()` in a new `src/domains/git/session-aggregator.ts` module. The function:

- Has **no vscode imports** — fully mockable and framework-free.
- Accepts a `SessionBriefingSources` dependency bundle (gitProvider, runLog, gitAnalyzer, getHygieneScan callback, logger).
- Applies **fail-fast** semantics for git-core calls (status, commits, changes), matching prior handler behavior.
- Applies **fail-soft** semantics for all peripheral sources: run log, git analytics, hygiene scan. Each failed peripheral omits its optional slice (`recentRuns`, `activityWindow`, `hygieneSnapshot`) and appends a visible flag to the briefing.

The session handler is refactored to a thin wrapper: call aggregator → pass aggregate into prose pipeline → return `SessionBriefingReport = SessionBriefing & { summary: string }`. The wire shape is backwards compatible; all existing consumers (webview, CSV export, chat formatter, LM envelope, skill handlers) continue to work unchanged.

The hygiene domain gains a `getLastScan()` accessor backed by a `lastScan` cache populated via an `onScanSuccess` callback injected into `createScanHandler`. Both manual dispatch and the background scheduler share the same handler, so the cache stays consistent.

## Alternatives considered

**New `session` domain** — Rejected. Adding a domain for one aggregate record introduces unnecessary routing surface. The git domain already owns session briefing; keeping the aggregator there maintains cohesion.

**Aggregator in `cross-cutting/`** — Rejected. The aggregator is more coupled to git domain types than to any cross-cutting concern. `cross-cutting/` is reserved for middleware-style infrastructure.

**Dispatcher-triggered hygiene scan** — Rejected. Triggering a full workspace scan from inside the aggregator is expensive (file I/O + AST analysis) and breaks the fail-soft contract — a slow scan would block the briefing. The pull-from-cache approach is O(1).

## Consequences

- `SessionBriefing` is the single authoritative aggregate for session state. Future surfaces (workflow run history, skill discoverability) should read from this record rather than re-fetching independently.
- Optional slices degrade gracefully; a fresh workspace with no run log and no hygiene scan still produces a valid briefing with informative flags.
- This pattern (framework-free aggregator, fail-soft peripheral sources, visible degradation flags) is reusable for future aggregates (e.g. workflow run history #5).
- `git/service.ts` constructor gains two optional deps (`runLog`, `getHygieneScan`); existing test fixtures pass `undefined` and remain unchanged.
