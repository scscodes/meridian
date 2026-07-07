# Meridian — Roadmap

See [FEATURES.md](./FEATURES.md) for the complete feature inventory.

**Thesis:** Meridian is a computed-insight instrument panel for your
repository — git analytics, workspace hygiene, dead-code and change
blast-radius, and a session briefing. Deterministic, inspectable, always
available. It does not wrap an LLM around commodity dev actions; it shows you
what your repo is doing. Every roadmap item either deepens that surface or is
deferred. (See [ADR 012](./adr/012-product-reanchor.md) for the re-anchor.)

---

## Now

Nothing currently in flight. Next natural candidates live in Deferred below —
none are commitments until picked up here.

---

## Deferred

- **Remote telemetry sink** — no destination exists; the run log is the local
  substrate.
- **`changeGrouper` as read-only insight** — the deterministic
  pending-change-structure logic salvaged from the cut `smartCommit`, surfaced
  as a panel rather than a commit action. Only if it earns its place.
- **Webview message typed generics** — ergonomic, not load-bearing.
- **Integration & E2E coverage for webview adapters** — valuable, scheduled
  opportunistically.

---

## Done

- **Session-briefing actionable cards** — raised flags render as actionable
  cards in the briefing panel with jump-to-section links and one-click
  actions, completing the presentation-only UI polish over
  `aggregateSessionBriefing()`.
- **Agent-readable latest snapshot** (ADR 020) — stable, versioned
  `.meridian/latest/*.v1.json` snapshots of all three reports, refreshed on
  every render; `.meridian/AGENTS.md` as a generated discovery pointer. File-
  shaped only — no runtime integration, no LM-tool surface.
- **Ecosystem registry** (ADR 018) — single source for language/toolchain
  semantics; JVM (Maven/Gradle/Kotlin/Scala) first-class; exclusion/bucket/
  categorization drift structurally eliminated.
- **Pulse history + retention + storage surface** (ADR 019) — longitudinal
  pulse slice in the session briefing; self-policing retention for
  `.meridian/artifacts/`, the run log, and pulse history; "Meridian Storage"
  tree section with Prune Now.
- **2.0 re-anchor** (ADR 012) — retired the LLM-commodity, chat-participant,
  LM-tool, workflow, and agent surfaces; kept the computed-insight core.
- **Foundations** — run log (ADR 009), dispatch lifecycle (ADR 008),
  session-briefing aggregator (ADR 011). The LM-tool-envelope foundation
  (ADR 010) was retired by ADR 012.
