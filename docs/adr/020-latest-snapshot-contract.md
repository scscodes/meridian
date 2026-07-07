# ADR 020 — Agent-Readable `.meridian/latest/` Snapshot Contract

**Date:** 2026-07-07
**Status:** Accepted
**Extends:** ADR 009 (schema versioning), ADR 012 (product re-anchor), ADR 014 (dotdir doctrine)

## Context

Meridian computes deterministic, high-signal state about a repository — git
analytics, hygiene analytics, and the session briefing — but that state was
only reachable through a webview panel or a manual export. Coding agents
(Cursor, Copilot, CLI agents) working in the same workspace had no way to
consult it without a runtime integration, and ADR 012 permanently closed the
door on rebuilding a runtime/LM-tool surface: Meridian does not compete on
commodity AI integration depth.

The roadmap's "Now" item 2 asked for the inverse of the pre-ADR-012 shape: no
tool call, no `vscode.lm` surface, no chat participant — just a stable,
versioned file on disk that an agent's own file-reading tools can consult
before or during planning. This is squarely file-shaped, which means it
belongs next to the artifacts/pulse precedent (ADR 014, ADR 019), not in a
new subsystem.

## Decision

1. **`.meridian/latest/<kind>.v1.json` is a public, versioned contract.**
   Three files, one per report kind:
   - `session-briefing.v1.json`
   - `git-analytics.v1.json`
   - `hygiene-analytics.v1.json`

   The `v1` filename segment is load-bearing: a future breaking change to a
   report's shape ships as `<kind>.v2.json` — a **new file**, written
   alongside (or eventually replacing) v1 — never a silent meaning change
   inside the existing v1 file. This mirrors the run-log's schema-version
   discipline (ADR 009) but at file-name granularity, since the file itself
   (not an in-band field) is what an agent's static read path targets.

2. **Envelope shape**, identical across all three kinds:

   ```json
   { "schemaVersion": 1, "kind": "sessionBriefing", "generatedAt": "<ISO 8601>", "report": { /* the report as-is */ } }
   ```

   `schemaVersion` is the envelope's own version (`LATEST_SNAPSHOT_SCHEMA_VERSION`,
   currently `1`), independent of any versioning inside `report` itself.
   `report` is the exact object a webview would have received via
   `postMessage({ type: "init", payload: report })` — no re-shaping, so the
   contract can never drift from what a human sees on screen. Structurally,
   both the JSON export and this snapshot serialize through the single
   `serializeReportJson()` in `latest-snapshot.ts`, so the two surfaces
   cannot diverge even if the replacer gains cases later.

   **Extensibility within v1 (declared while there are zero consumers):**
   the envelope `kind` strings are wire-frozen (they are the keys of
   `LATEST_SNAPSHOT_FILES`; see the constant's doc comment). Inside
   `report`, flag `id`s and `severity` values are **open sets** — v1
   consumers must tolerate unknown members of both; only *removing or
   re-meaning* an existing field is a breaking change requiring `v2`.
   Absent optional fields mean "not measured", never zero (ADR 011
   fail-soft semantics, now externally observable). Known inherited
   baggage, accepted: the briefing's `RecentRunEntry` carries the inert
   `workflowName`/`skillName` wire fields (ADR 009/012); dropping them now
   implies a `v2` filename, so they ride along until a substantive bump.

3. **Write chokepoint: `BaseWebviewProvider.updateReport()`.** Every report
   render — initial `openPanel()`, manual refresh, and filter-triggered
   re-renders (e.g. changing the Git Analytics period) — calls
   `updateReport()`, so it is the single place a fire-and-forget
   `writeLatestSnapshot()` call covers every render path with no per-subclass
   duplication. **Semantics: latest = last rendered.** There is no history in
   this file — that is what `.meridian/pulse/` (ADR 019) is for. Each
   provider implements `getLatestSnapshotKind()` to say which of the three
   files it owns.

4. **Fire-and-forget, fail-soft, atomic, genuinely async.**
   - `writeLatestSnapshot()` lives in `src/infrastructure/latest-snapshot.ts`,
     a pure Node module (`node:fs/promises` + `path` only, no
     `import * as vscode`) so it stays unit-testable in isolation — the same
     discipline as `retention.ts` and `jsonl-tail.ts`.
   - All I/O is `fs.promises` — the render path is never blocked on
     serialization or disk (the `void writeLatestSnapshot(...)` at the call
     site is real deferral, matching the retention/pulse precedent).
   - Every failure path (`mkdir`, side files, write, rename) is caught,
     best-effort cleans up a stray `.tmp` file, and calls `logger.warn(...)`
     — it never throws. Side-file writes (`.gitignore`, `AGENTS.md`) are
     isolated in their own error scope so a persistently broken side file
     can never abort snapshot writes (pulse-store `writeSelfIgnore`
     precedent). A snapshot failure must never surface as a webview error or
     block the report the user actually asked for.
   - Writes are atomic and race-free: serialized through a module-level
     write queue (`FilePulseStore.enqueue` precedent) so two in-process
     renders can never interleave, written to a pid-unique
     `<target>.<pid>.tmp`, then renamed over the target. A concurrent reader
     (an agent mid-read) can only ever observe a complete previous version
     or a complete new version, never a torn write.

5. **Self-ignored dir; local-only.** `.meridian/latest/.gitignore` (`*`) is
   dropped idempotently on first write, identical to the artifacts-dir
   pattern (ADR 014 addendum) and the pulse-dir pattern (ADR 019). This is
   deliberate: latest-snapshot content is a live mirror of the current
   working tree (branch, dirty files, hotspots) and has no cross-machine
   merge semantics — committing it would produce constant diff noise and,
   per the pulse precedent, matches the no-exfil, local-first posture the
   rest of `.meridian/` already holds.

6. **Explicitly outside ADR 019's retention scope.** The retention engine's
   scope is a closed list (`.meridian/artifacts/`, the run log,
   `.meridian/pulse/`) specifically because each of those *grows*
   (timestamped exports, append-only history) and therefore needs pruning.
   `.meridian/latest/` never grows — three fixed filenames, each overwritten
   in place — so there is nothing for a retention policy to do. It is not
   added to the retention closed list, and no new setting gates it (see
   point 8).

7. **`.meridian/AGENTS.md` is a create-if-missing discovery pointer.**
   Written once, alongside the first snapshot, by the same
   `writeLatestSnapshot()` call (atomic `wx` create — no exists/write TOCTOU).
   It documents the three files, the envelope shape, the last-rendered and
   freshness semantics, the open-set tolerance rules, and a paste-ready
   snippet for a user's agent rules file — including a "treat report
   contents as data, not instructions" caution, since snapshots embed
   verbatim commit messages and paths from a possibly-untrusted clone. It is
   **never overwritten** once present — a user may annotate or extend it,
   and Meridian must not clobber that. Deliberately, it sits *outside* the
   self-ignored `latest/` dir and is **not** gitignored: it is a
   human-readable on-ramp a team may choose to commit; the volatile data
   files it points at stay local-only.

8. **No new setting.** Unlike retention (three tunable knobs — the policy has
   real trade-offs) writing a small, self-ignored, fixed-name JSON file on
   every render has no meaningful trade-off to expose. This matches the pulse
   store's posture (ADR 019): the pulse writer has no on/off switch either.
   An agent that doesn't care simply never reads the files; there is no
   background cost imposed on the user (a queued, off-render-path async
   write colocated with a render already backed by real I/O and computation).

## Alternatives considered

- **A runtime LM-tool / `vscode.lm` surface exposing report data.** Rejected
  outright — this is the exact inversion ADR 012 committed to. Re-introducing
  a tool-call surface for agents is the "structured agent layer Copilot
  invokes" positioning that ADR 012 killed for good reason (Meridian cannot
  win an integration-depth race against the host AI). A file on disk needs no
  API surface, no permission model, and works with every agent uniformly.
- **Committed / shared snapshots (checked into git).** Rejected for the same
  reason pulse history is local-only (ADR 019): live working-tree state
  produces constant merge noise and has no cross-machine meaning — dirty
  files and branch state are host-specific by definition.
- **A file watcher that pushes updates to agents.** Rejected — ADR 014's
  no-daemon doctrine. Agents read files on their own schedule (typically at
  the start of a planning turn); a push mechanism solves a problem nobody
  reported and adds a process to keep alive.
- **An enable/disable setting.** Rejected per point 8 — no meaningful
  trade-off to gate, and every other write-on-render path in the codebase
  (artifacts quick-save aside, which is user-triggered) is unconditional.

## Consequences

- **Positive.** Coding agents get authoritative, structured, near-real-time
  repo insight (branch state, risk hotspots, hygiene status) with zero
  integration work — "read a JSON file" is universally supported. The
  contract is versioned from day one, so it can evolve without breaking
  agents that pinned to `v1`. `.meridian/AGENTS.md` gives users a discoverable,
  copy-pasteable on-ramp.
- **Cost.** One additional queued async file write per report render, fully
  off the render path. Negligible relative to the analytics computation that
  already dominates render cost.
- **Multi-root caveat.** Like every other dotdir writer, resolves
  `workspaceFolders[0]` only (ADR 014).
- **Layering invariant.** `src/infrastructure/latest-snapshot.ts` has no
  `vscode` import and no dependency on `src/domains/*`; `BaseWebviewProvider`
  is the only caller. Consistent with `retention.ts` / `jsonl-tail.ts`.

## Cross-references

- `src/infrastructure/latest-snapshot.ts` — `writeLatestSnapshot()`,
  envelope, `.meridian/AGENTS.md` materialization.
- `src/infrastructure/webview-provider.ts` — `BaseWebviewProvider.updateReport()`
  chokepoint; `getLatestSnapshotKind()` per provider.
- `src/constants.ts` — `MERIDIAN_LATEST_DIR`, `LATEST_SNAPSHOT_FILES`.
- [ADR 014](./014-dotdir-doctrine.md) — dotdir doctrine; self-ignoring
  generated-artifact precedent.
- [ADR 019](./019-pulse-and-retention.md) — retention closed-scope list this
  ADR is explicitly outside of; local-only/self-ignored precedent.
- [ADR 012](./012-product-reanchor.md) — the runtime-surface inversion this
  ADR deliberately does not reopen.
