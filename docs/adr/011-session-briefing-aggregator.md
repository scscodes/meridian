# ADR 011 — Session Briefing Aggregator: Cross-Domain Reader Pattern

**Date:** 2026-04-20
**Status:** Accepted (promoted)

## Current state (post-2.0, authoritative)

The aggregator is **promoted** to the product's connective tissue and forward headline (ADR 012). It is the single authoritative cross-domain reader — see Decision/Consequences, still fully in force.

- **Surviving consumers — exactly two:** the session-briefing webview (`src/domains/git/session-briefing-ui/`) and the `git.sessionBriefing` command, the latter passing the aggregate through the ADR 004 prose pipeline (degrading to the raw computed record when `vscode.lm` is absent). The "feeds chat participant / LM tools / skill handlers / future surfaces" framing is **void** — those surfaces were deleted in 2.0.
- **Inert wire fields:** `RecentRunEntry.workflowName` / `skillName` are always `undefined` (see [ADR 009](./009-run-log-schema-versioning.md) Current state). The aggregate still carries them for wire compatibility; do not build on them.
- **The sole structured consumer reads `recentCommits` only.** The webview (`src/domains/git/session-briefing-ui/script.js`) renders `report.recentCommits` and the prose/deterministic `summary` string; it does **not** read `activityWindow` / `hygieneSnapshot` structurally. There is **no session-briefing CSV export** (CSV is a git-analytics surface only — an earlier "CSV export" consumer claim was inaccurate). Consequence: `activityWindow` / `hygieneSnapshot` reach the user *exclusively* via `deterministicSummary()` text and the ADR 004 prose `data` passthrough. Widening those slices without also extending the summary/prose surface ships data nothing renders.
- **Additive wire-shape extension is sanctioned and backward-compatible.** Adding *optional* fields to `ActivityWindow` / `HygieneSnapshot` (e.g. retaining `trends`, top churn/volatility files, a bounded dead-code sample already computed and discarded in-aggregator) is the sanctioned way to enrich the briefing under the "extend this aggregator" rule below. It is backward-compatible because the only structured reader ignores those slices and prose `data` is an open `Record`. Constraints: fields stay optional; bounded (sample-limited via `SESSION_BRIEFING` constants, not unbounded); the **git-core fail-fast guarantee is inviolate** — `recentCommits` must remain sourced from the fail-fast git-core path and must **not** be re-derived from a fail-soft peripheral (e.g. analytics), as that would silently demote a guaranteed field to best-effort. This does **not** touch the [ADR 009](./009-run-log-schema-versioning.md) run-log on-disk schema (analytics/hygiene are not run-log sourced); no schema-version bump.

**Depends on:** [ADR 009](./009-run-log-schema-versioning.md) (run-log substrate it reads via `RunLog.readLatest`) and [ADR 004](./004-prose-fn-injection.md) (the prose pipeline its command consumer feeds). *(Earlier "Depends on: ADR 008 dispatch signaling" was inaccurate — the aggregator reads the persisted run log, not router dispatch events.)*

## Context

The `git.sessionBriefing` handler already owned session state aggregation, but its scope was limited to git working-tree data (status, recent commits, uncommitted changes). Foundation #1 (ADR 009) introduced the run log. The roadmap called for a richer `SessionBriefing` record combining the operational sources: git state, run-log execution history, git analytics, and workspace hygiene state.

The aggregation logic needed to be separated from the prose-generation step so the same record can feed the webview and the command's prose pipeline without re-fetching raw data independently. *(The original motivation also cited LM-tool / chat / future surfaces as consumers; those were removed in 2.0 — see Current state for the two that survive.)*

## Decision

Introduce `aggregateSessionBriefing()` in a new `src/domains/git/session-aggregator.ts` module. The function:

- Has **no vscode imports** — fully mockable and framework-free.
- Accepts a `SessionBriefingSources` dependency bundle (gitProvider, runLog, gitAnalyzer, getHygieneScan callback, logger).
- Applies **fail-fast** semantics for git-core calls (status, commits, changes), matching prior handler behavior.
- Applies **fail-soft** semantics for all peripheral sources: run log, git analytics, hygiene scan. Each failed peripheral omits its optional slice (`recentRuns`, `activityWindow`, `hygieneSnapshot`) and appends a visible flag to the briefing.

The session handler is a thin wrapper: call aggregator → pass aggregate into the ADR 004 prose pipeline → return `SessionBriefingReport = SessionBriefing & { summary: string }`. The surviving consumer is the session-briefing webview, which reads `recentCommits` and the `summary` string. *(The original list also named chat formatter / LM envelope / skill handlers / a session-briefing CSV export; the first three were deleted in 2.0 and the CSV export never existed for this surface — see Current state.)*

The hygiene domain gains a `getLastScan()` accessor backed by a `lastScan` cache populated via an `onScanSuccess` callback injected into `createScanHandler`. Both manual dispatch and the background scheduler share the same handler, so the cache stays consistent.

## Alternatives considered

**New `session` domain** — Rejected. Adding a domain for one aggregate record introduces unnecessary routing surface. The git domain already owns session briefing; keeping the aggregator there maintains cohesion.

**Aggregator in `cross-cutting/`** — Rejected. The aggregator is more coupled to git domain types than to any cross-cutting concern. `cross-cutting/` is reserved for middleware-style infrastructure.

**Dispatcher-triggered hygiene scan** — Rejected. Triggering a full workspace scan from inside the aggregator is expensive (file I/O + AST analysis) and breaks the fail-soft contract — a slow scan would block the briefing. The pull-from-cache approach is O(1).

## Consequences

- `SessionBriefing` is the single authoritative aggregate for session state. **Any new cross-domain reader must read from this record (or extend this aggregator) rather than re-fetching independently** — this is the one sanctioned cross-domain seam (ADR 012 confirms: git/hygiene panels and this module have zero coupling to deleted domains).
- Optional slices degrade gracefully; a fresh workspace with no run log and no hygiene scan still produces a valid briefing with informative flags.
- This pattern (framework-free aggregator, fail-soft peripheral sources, visible degradation flags) is the reusable template for any future aggregate.
- `git/service.ts` constructor gains two optional deps (`runLog`, `getHygieneScan`); existing test fixtures pass `undefined` and remain unchanged.
