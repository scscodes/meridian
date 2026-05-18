# ADR 012 — Product Re-anchor: Computed-Insight Instrument Panel

**Date**: 2026-05-18
**Status**: Accepted
**Supersedes**: ADR 003, ADR 007, ADR 010
**Revises**: ADR 004, ADR 006, ADR 008 (router dispatch lifecycle), ADR 009, ADR 011

---

## Context

Meridian's marketed surface was an LLM-wrapper command/chat layer: PR
generation, AI review, conflict resolution, natural-language task routing, 21
language-model tools, and a `@meridian` chat participant. Tested directly
against Copilot and Cursor, that surface is a strictly worse version of the
commercial equivalent. A solo-maintained extension cannot win the
model-quality / integration-depth / funding race on commodity AI, and "open an
extension to use its AI tool" is not a behavior modern developers exhibit.

The durable, defensible part of the codebase is the **computed, deterministic,
inspectable** surface: git analytics (churn, volatility, authorship),
workspace hygiene (dead files, dead code, large/stale files), TS-compiler-API
impact analysis, the append-only run log, and the session-briefing aggregate.
None of these are things Copilot can do — it is request/response with no
persistent project-state observability.

Verified during planning: the git/hygiene webview panels and
`session-aggregator.ts` have **zero import coupling** to the
chat/skill/workflow/agent domains. The run log is a generic substrate fed by
the router for every dispatch; it does not depend on those domains existing.

## Decision

Re-anchor the product from "the structured agent layer Copilot invokes" to
**a computed-insight instrument panel for your repository**.

1. **Retire the entire LLM-commodity and chat/automation surface.** Delete the
   `chat`, `skill`, `workflow`, and `agent` domains; the `git` LLM wrappers
   (`generatePR`, `reviewPR`, `commentPR`, `resolveConflicts`, `analyzeInbound`,
   `smartCommit`); `hygiene.reviewFile`; all 21 `languageModelTools`; and the
   `chatParticipants` contribution.
2. **Keep all computed/deterministic insight logic.** Git analytics + exports,
   hygiene scan + dead-code, impact analysis, the run log, and the
   session-briefing aggregate (`session-aggregator.ts`,
   `session-briefing-ui/`).
3. **The session briefing is the connective tissue and the forward headline.**
   It and `hygiene.impactAnalysis` are the two surviving `GenerateProseFn`
   consumers (ADR 004), each degrading gracefully to the raw computed result
   when `vscode.lm` is unavailable.
4. **Ship as a major version (2.0.0), marketplace-listed, clean break.** No
   deprecation shim — the audience is small and a shim is more code and more
   churn than a documented removal.

## Consequences

- **Positive.** Sharper identity; smaller code and maintenance surface; the
  remaining surface is one nobody else ships and Copilot structurally cannot.
  The change is overwhelmingly deletion, so regression risk is low.
- **Breaking.** Every removed command, LM tool, and the chat participant
  disappears for any existing user. Accepted: major bump, documented in
  `CHANGELOG.md`, small audience.
- **Vestigial-but-retained.** The run-log `source` enum and
  `RecentRunEntry.workflowName/skillName` become permanently unused. They are
  kept to preserve ADR 009 schema stability and ADR 011 backward compatibility;
  the run-log schema version is **not** bumped.
- **ADR fallout.** ADR 003 (single NL classifier) and ADR 010 (LM tool
  envelope) describe deleted subsystems → retired. ADR 007 (workflow tree step
  expansion) describes a deleted provider → retired. ADR 004/006/008-lifecycle/
  009/011 are revised in place to drop references to the removed surface.
