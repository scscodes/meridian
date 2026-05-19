# ADR 011 — Session Briefing Aggregator: Cross-Domain Reader Pattern

**Date:** 2026-04-20
**Status:** Accepted (promoted)

## Current state (post-2.0, authoritative)

The aggregator is **promoted** to the product's connective tissue and forward headline (ADR 012). It is the single authoritative cross-domain reader — see Decision/Consequences, still fully in force.

- **Surviving consumers — exactly two:** the session-briefing webview (`src/domains/git/session-briefing-ui/`) and the `git.sessionBriefing` command, the latter passing the aggregate through the ADR 004 prose pipeline (degrading to the raw computed record when `vscode.lm` is absent). The "feeds chat participant / LM tools / skill handlers / future surfaces" framing is **void** — those surfaces were deleted in 2.0.
- **Inert wire fields:** `RecentRunEntry.workflowName` / `skillName` are always `undefined` (see [ADR 009](./009-run-log-schema-versioning.md) Current state). The aggregate still carries them for wire compatibility; do not build on them.
- **Consumer surface — three paths, all of `SessionBriefingReport` (`SessionBriefing & { summary }`):**
  1. **HTML render** (`src/domains/git/session-briefing-ui/script.js`) — reads `branch` / `isDirty` / `generatedAt` / `staged` / `unstaged` / `untracked` / `flags` / `recentCommits` / `uncommittedFiles` / `summary`. It does **not** read `activityWindow` / `hygieneSnapshot` structurally; those reach the screen only through the `summary` string.
  2. **JSON export** (`SessionBriefingWebviewProvider` via `BaseWebviewProvider.reportToJson`) — `JSON.stringify` of the whole report; serializes every field including optional slices.
  3. **CSV export** (`SessionBriefingWebviewProvider.reportToCsv`) — hand-rolled, explicit-field: branch state + recent-commits table + uncommitted-files table. Does **not** emit `activityWindow` / `hygieneSnapshot`.
  Consequence: `activityWindow` / `hygieneSnapshot` reach the user via the `summary` text (HTML), the prose `data` passthrough (ADR 004), and JSON export; the CSV export does not surface them. Widening those slices without extending the summary/prose surface ships data the HTML/CSV paths do not show.
- **Additive wire-shape extension is sanctioned and backward-compatible.** Adding *optional* fields to `ActivityWindow` / `HygieneSnapshot` (e.g. retaining `trends`, top churn/volatility files, a bounded dead-code sample already computed and discarded in-aggregator) is the sanctioned way to enrich the briefing under the "extend this aggregator" rule below. It is backward-compatible across all three paths: the HTML reader ignores unknown slices, JSON export is whole-object (new fields ride along), and the CSV serializer is explicit-field (unaffected, never malformed). Constraints: fields stay optional; bounded (sample-limited via `SESSION_BRIEFING` constants, not unbounded); the **git-core fail-fast guarantee is inviolate** — `recentCommits` must remain sourced from the fail-fast git-core path and must **not** be re-derived from a fail-soft peripheral (e.g. analytics), as that would silently demote a guaranteed field to best-effort. This does **not** touch the [ADR 009](./009-run-log-schema-versioning.md) run-log on-disk schema (analytics/hygiene are not run-log sourced); no schema-version bump.
- **Freshness (2026-05-19) — realized additive retentions.** The sanctioned extension above is now exercised: `ActivityWindow` carries `trends`, `topChurnFiles`, and `commitFrequency` (the last a `SESSION_BRIEFING.SPARKLINE_MAX_POINTS`-bounded tail of the analytics commit-frequency series, rendered as an inline-SVG sparkline — no chart dependency added to the briefing webview); `HygieneSnapshot` carries `deadCodeSample`. Each stays optional, bounded by a `SESSION_BRIEFING` constant, and analytics-sourced (fail-soft), leaving the git-core fail-fast guarantee intact. Path-routing has correspondingly advanced past the bullets above: the **HTML reader now structurally renders** `activityWindow.{trends,topChurnFiles,commitFrequency}` and `hygieneSnapshot.{counts,deadCodeSample}` (not via `summary` text only), and the **CSV serializer now emits** the `trends` / top-contributors / `topChurnFiles` / hygiene / dead-code tables (still explicit-field, so unknown future slices remain unaffected). `commitFrequency` is the one deliberate exception — viz-only: it rides JSON export and the ADR 004 prose `data` passthrough, and is intentionally **not** added to the explicit-field CSV or the deterministic plain-text summary (a numeric series is noise in both).
- **Freshness (2026-05-19) — `pendingChangeRisk`, the 4th additive slice (Plan A1, branch `feat/pending-change-risk`).** A new optional **top-level** `SessionBriefing.pendingChangeRisk` slice (deliberately *not* nested in `ActivityWindow`: its fail-soft predicate differs — it is present iff analytics is available, but its dirty-set input is git-core/fail-fast). It is the deterministic join of the dirty-set (`gitProvider.getAllChanges`, already fetched) against the already-computed `GitAnalyticsReport.files` risk model — **pure post-processing, zero new I/O**. Files absent from the analytics window are annotated `new` (status `A` — no history) or `cold` (status `M`/`D` — changed but quiet in-window: *low, not unknown*). It is **full-surface, not viz-only**: structural HTML table, explicit-field CSV block, JSON whole-object, a one-line deterministic `summary` sentence + bulleted high-risk list, and a `flags` entry at `PENDING_RISK.HOTSPOT_FLAG_THRESHOLD`; bounded by `PENDING_RISK.MAX_FILES` applied **after** the deterministic risk→volatility→path sort so the worst files are never truncated. Notes for future readers: (1) **Test-coverage signal is an explicit NON-GOAL** — it was scoped out because the only deterministic way to compute it (AST/stem-match importer resolution) is the low-precision heuristic this project rejected on ROI grounds; do not "helpfully" re-add it. (2) The ADR 004 prose `data` is a **hand-picked allowlist** in `session-handler.ts`, *not* a whole-object passthrough — a new slice does **not** "ride free" into prose and must be added explicitly (this slice was). (3) Rename normalization is now a single shared `normalizeRenamePath` (`git-path.ts`) used by both the analytics `FileMetric` path and this join — previously an untested inline regex in `analytics-service`; divergence would silently break the join. (4) Known pre-existing limits, not regressions: a renamed file often surfaces with status `M` (not `R`) because `git-provider`'s porcelain `statusMap` misses the brace-form numstat path — A1 does not modify `git-provider`; and dirty files under `ANALYTICS_EXCLUDE` (e.g. `out/`) are always `new`/`cold` since analytics never sees them.

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

The session handler is a thin wrapper: call aggregator → pass aggregate into the ADR 004 prose pipeline → return `SessionBriefingReport = SessionBriefing & { summary: string }`. The surviving consumer is the session-briefing webview and its JSON/CSV export (see Current state for the three exact read paths). *(The original list also named chat formatter / LM envelope / skill handlers; all deleted in 2.0.)*

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
