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

1. **Session-briefing UI polish** — the briefing is the connective tissue that
   makes the analytics/hygiene panels get reopened. Richer presentation over
   the existing `aggregateSessionBriefing()` record: actionable cards, inline
   panel links, quick filters. Prose stays optional and degrades to the raw
   aggregate when `vscode.lm` is unavailable.
   - Primary files: `src/domains/git/session-briefing-ui/`,
     `src/domains/git/session-aggregator.ts`.

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

- **2.0 re-anchor** (ADR 012) — retired the LLM-commodity, chat-participant,
  LM-tool, workflow, and agent surfaces; kept the computed-insight core.
- **Foundations** — run log (ADR 009), dispatch lifecycle (ADR 008),
  session-briefing aggregator (ADR 011). The LM-tool-envelope foundation
  (ADR 010) was retired by ADR 012.
