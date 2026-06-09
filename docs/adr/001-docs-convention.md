# ADR 001 — Documentation Convention

**Date**: 2026-03-04
**Status**: Accepted

---

## Context

As the project grows, docs drift: completed work accumulates in ROADMAP, features get described in multiple places, and JSDoc comments explain what the code already says. We need a lightweight convention that keeps docs lean and trustworthy.

---

## Decision

### File Roles (one job each)

| File | Job | What does NOT belong |
|------|-----|----------------------|
| `ROADMAP.md` | Upcoming work only. Completed phases get a one-line summary — not a full section. | Completed task details, architecture explanations |
| `FEATURES.md` | Canonical feature inventory and command reference. Source of truth for what Meridian can do. | Implementation details, rationale, roadmap status |
| `ARCHITECTURE.md` | Structural overview for onboarding: layers, patterns, extension points, file map. | Full code examples (read the code), implementation status checklists |
| `docs/adr/` | Architectural decisions that need rationale preserved. Format: Context → Decision → Consequences. | Operational runbooks, feature docs |

### Rules

1. **No redundancy.** If it's in `FEATURES.md`, it's not also in `ROADMAP.md`. If it's readable from the code, it's not in `ARCHITECTURE.md`.

2. **Collapse completed phases.** When a ROADMAP phase ships, collapse the full task list to one line (e.g., "Chat NL-First Refactor — shipped"). Never delete: the one-liner preserves history without the noise.

3. **Update FEATURES.md with every new command.** Adding a new command? Add it to FEATURES.md in the same PR. No exceptions.

4. **Update ARCHITECTURE.md when domain boundaries change.** New domain, new infrastructure component, or changed layer responsibilities → update the structural overview.

5. **Write ADRs for decisions that need rationale.** Use this format when the "why" matters and would be lost in code. Skip for obvious or reversible decisions.

6. **JSDoc: explain why, not what.** High-ROI comments describe non-obvious intent, invariants, or gotchas. Do not document function signatures the type system already captures.

---

## Consequences

- Docs stay lean enough to trust. Stale docs are worse than no docs.
- New contributors get accurate structural context from ARCHITECTURE.md without wading through completed changelogs.
- FEATURES.md becomes the authoritative command reference — link to it rather than duplicating.
- Rationale for architectural choices is preserved in ADRs without polluting other docs.
