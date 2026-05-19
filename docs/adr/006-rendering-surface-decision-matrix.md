# ADR 006 — Rendering Surface Decision Matrix

**Date**: 2026-03-09
**Status**: Accepted — matrix current as revised by [ADR 012](./012-product-reanchor.md)

## Current state (post-2.0, authoritative)

The four live rendering surfaces are **webview panel · tree panel · output channel · toast**. There is no chat surface and no LM-tool surface — the `chat` domain and `chat-participant.ts` were deleted in 2.0. The matrix, rules, and references below have been realigned to these four; treat them as the current authority for any new or migrated command. The former ADR 006 compliance backlog (`hygiene.reviewFile`, `git.resolveConflicts`, `chat.delegate`) is void — those commands no longer exist, so they are not "non-compliant," they are gone.

---

## Context

As Meridian's command set grew, each new command chose its rendering surface ad-hoc — some writing to the output channel, some opening toasts, some using webview panels. No shared framework existed for this decision. The originating symptoms (pre-2.0): duplicated rendering logic across files with one dead path, step-level execution data silently discarded at the tree boundary, and an error path that never revealed the output channel or offered "Show Output" on failure. The same decision was being made inconsistently by every developer touching a new command. The matrix below exists to make that decision once, deterministically.

---

## Decision

Surface choice is determined by **output shape and trigger source**, not by command domain. The following matrix is authoritative for all new commands and governs incremental migration of existing ones:

| Output shape | Primary intent | Surface |
|---|---|---|
| Structured multi-entity report (analytics, history) | Review / explore | Webview panel |
| Ordered step sequence with per-item pass/fail | Monitor / debug | Tree panel expansion |
| Long-form prose (session briefing, impact analysis) | Copy / share | Output channel + clipboard |
| Short scalar / status (git status, scan summary) | Glance | Toast |

### Rules

1. **Output channel is a last resort**, not a default. It is appropriate only when the content is long-form prose the user will copy elsewhere, or for failure diagnostics when no richer surface is available.

2. **Webview panels require visual structure** — charts, sortable tables, filter bars. Do not open a panel for plain text or a list that would fit in a tree.

3. **Tree expansion** is appropriate when the parent entity already exists in the tree and the result is an ordered child sequence (workflow steps, scan files, dead-code issues). The tree provides persistent, navigable state that the output channel cannot.

4. **"Show Output" error button is mandatory** whenever the command's happy path writes to the output channel. If the output channel contains the diagnostic detail, errors must offer to reveal it. Fixed centrally in `command-registry.ts` — not per-command.

### Scope

Applies to all new commands. Existing commands are migrated incrementally, prioritized by user-facing impact. Commands not yet migrated are not violations — they are backlog items.

### Known existing non-compliance

None outstanding. The two prior entries (`git.resolveConflicts`, `chat.delegate`) referenced commands deleted in 2.0 and are void. New non-compliance, if introduced, is tracked as backlog per the Scope rule above.

---

## Consequences

**Good:**
- New commands have a clear, documented answer for "where does this result go?"
- Tree expansion provides persistent, interactive step detail without webview infrastructure cost.
- Centralizing the error-surface fix in `command-registry.ts` means all future commands get "Show Output" for free.

**Watch out:**
- Do not add webview panels for data that has no chart or table structure. The cost of HTML/JS/CSS is only justified when the data benefits from visual encoding.
- Do not write to the output channel for results that belong in the tree. The channel is ephemeral — scrolled away and forgotten. Tree state persists across the session.

---

## Reference

- `src/presentation/result-presenters.ts` — ok-path formatter per command
- `src/presentation/command-registry.ts` — dispatch loop, error path (centralized "Show Output")
- `src/presentation/specialized-commands.ts` — panel/palette trigger path for specialized commands
- `src/ui/tree-providers/` — tree panel expansion implementations
- `src/infrastructure/webview-provider.ts` — `BaseWebviewProvider<T>` for webview panels
