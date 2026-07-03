# ADR 019 — Pulse History, Retention Engine, and the Storage Surface

**Date:** 2026-07-03
**Status:** Accepted
**Extends:** ADR 009 (schema versioning), ADR 011 (additive briefing slices), ADR 014 (dotdir doctrine)

## Context

Two gaps, one theme — Meridian observes the workspace over time but kept no
history, and polices the user's hygiene while leaving its own storage
unbounded:

1. **No longitudinal signal.** Every report was point-in-time. The session
   briefing could not answer "is this repo getting healthier or worse since
   yesterday?" — the product's stated identity ("general pulse of the project
   as it evolves") had no data substrate.
2. **Unbounded self-storage.** The run log
   (`.vscode/meridian/run-log.v1.jsonl`) was append-only with no rotation, and
   `.meridian/artifacts/` accumulated timestamped exports forever. ADR 014
   explicitly deferred retention; an enterprise-adopted tool with
   unbounded-growth files is a liability.

## Decision

### 1. Pulse store (`.meridian/pulse/pulse.v1.jsonl`)

- **Versioned JSONL, ADR 009 discipline**: `PulseSnapshotV1`
  (`schemaVersion: 1`), append-rejects unsupported versions, serialized writes
  through a queue (`infrastructure/pulse-store.ts`, modeled on `FileRunLog`).
- **Tolerant reader.** Unlike the run log's strict reader, malformed or
  future-versioned lines are skipped with a warning, not a hard error — pulse
  is a fail-soft peripheral by contract; a torn line must not kill briefings.
- **Location & sharing.** Lives under `.meridian/` (workspace insight, not
  host-runtime trace), but **self-ignored** via the artifacts-dir `.gitignore`
  pattern: an append-only JSONL shared through git would merge-conflict across
  machines and interleave unrelated hosts' sessions.
- **Capture point.** `aggregateSessionBriefing()` reads history, builds the
  current snapshot from data already in scope (git core, activity window,
  hygiene snapshot, pending risk — zero new analysis), and appends. Appends
  are **throttled** (`PULSE.MIN_APPEND_INTERVAL_MS`, 10 min): several
  briefings in one sitting are one working session, not several data points.
  Optional snapshot fields are absent when unmeasured — never zero-filled.
- **Briefing slice.** Additive, optional `SessionBriefing.pulse`
  (ADR 011 rule): deltas vs the previous snapshot (only for fields measured on
  both sides), a bounded series (`PULSE.SERIES_LIMIT`) ending at "now", and an
  `appended` marker. Rendered as delta cards + inline-SVG trend lines in the
  briefing webview; summarized in the deterministic text; passed to the
  optional prose layer. Fail-soft flags: "Pulse history unavailable" /
  "Pulse history not recorded".

### 2. Retention engine (`infrastructure/retention.ts`)

- **Scope is a closed list**: `.meridian/artifacts/` (count + age caps),
  the run log (event cap via new `RunLog.compact()`), `.meridian/pulse/`
  (self-capping at `PULSE.MAX_SNAPSHOTS` inside the store). Nothing else is
  ever touched; artifact deletion joins only self-listed basenames; the
  self-ignore `.gitignore` is never a prune target.
- **Settings-backed policy** through the ADR 013 chokepoint:
  `retention.artifacts.maxCount` (50), `retention.artifacts.maxAgeDays` (30),
  `retention.runLog.maxEvents` (5000); `0` disables a rule.
- **Lazy enforcement, no daemons** (ADR 014 doctrine): once at activation
  (fire-and-forget, never blocks) and after each quick-save export. Run-log
  compaction executes **inside the write queue** — the only race-safe point —
  as a raw-line tail-keep with atomic tmp+rename (`jsonl-tail.ts`), never
  parsing, so v1 schema pinning is untouched.
- **Plan/act share one function.** `planArtifactPrune()` is pure; the storage
  surface's "would prune" preview and the actual prune both consume it, so
  they cannot disagree.

### 3. Storage surface

- Per the ADR 006 matrix: a small structured record with glance intent →
  **tree, not webview**. A "Meridian Storage" section in the Hygiene view
  (rows: Exported Reports, Run Log, Pulse History; footprint + would-prune
  preview), fail-soft (omitted on error). All affordances are Meridian-owned
  surfaces per ADR 016.
- `hygiene.storageStatus` / `hygiene.pruneStorage` are router-dispatched
  domain handlers (Result monad, run-log observability for free).
  `meridian.hygiene.pruneStorage` is an ADR 005 specialized registration:
  status preview → confirmation modal → prune → toast summary + tree refresh.

## Alternatives considered

- **Pulse in the run log.** Rejected: different lifecycle (host-runtime trace
  vs workspace insight), different reader tolerance, and it would force a
  run-log schema bump ADR 012 explicitly reserved for substantive needs.
- **Committed (shared) pulse history.** Rejected — merge conflicts and
  cross-host interleaving; local-first matches the no-exfil posture.
- **Timer-based retention.** Rejected per ADR 014's no-daemon doctrine; write
  paths and activation are sufficient enforcement points.
- **Webview storage report.** Rejected — no chart/table density that justifies
  a panel (ADR 006 Rule 2).

## Consequences

- **Positive.** The briefing gains the longitudinal dimension the product
  thesis promised; Meridian-owned storage is bounded by default and visibly
  self-policed — "we point our own hygiene engine at ourselves" is now a
  demonstrable claim.
- **Cost.** Three new settings; one new dotdir subdir; retention defaults
  (50 files / 30 days / 5000 events) silently delete aged exports — mitigated
  by documented settings, `0`-disables semantics, and the storage node making
  the policy visible.
- **Multi-root caveat.** Pulse store and retention use `workspaceFolders[0]`,
  matching the existing single-root assumption (ADR 014).
- **Cross-references:** `src/infrastructure/{pulse-store,retention,jsonl-tail}.ts`,
  `src/domains/hygiene/storage-handler.ts`, `SessionBriefing.pulse`
  (`src/domains/git/types.ts`), tests
  `pulseStore/retention/storageHandler/run-log/sessionAggregator`.
