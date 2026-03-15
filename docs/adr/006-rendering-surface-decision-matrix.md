# ADR 006 — Rendering Surface Decision Matrix

**Date**: 2026-03-09
**Status**: Accepted

---

## Context

As Meridian's command set grew, each new command chose its rendering surface ad-hoc — some writing to the output channel, some opening toasts, some using webview panels, some using the chat stream. No shared framework existed for this decision. The result: `workflow.run` duplicated rendering logic across two files (one path dead), step-level execution data was silently discarded at the tree boundary, and the error path in the command registry never showed the output channel or offered "Show Output" on failure. The same decision was being made inconsistently by every developer touching a new command.

---

## Decision

Surface choice is determined by **output shape and trigger source**, not by command domain. The following matrix is authoritative for all new commands and governs incremental migration of existing ones:

| Output shape | Primary intent | Surface |
|---|---|---|
| Structured multi-entity report (analytics, history) | Review / explore | Webview panel |
| Ordered step sequence with per-item pass/fail | Monitor / debug | Tree panel expansion |
| Long-form prose (PR body, briefing, conflict resolution) | Copy / share | Output channel + clipboard |
| Short scalar / status (git status, scan summary) | Glance | Toast or chat inline |
| NL-triggered result (chat path) | Read / interact | Chat markdown |

### Rules

1. **Output channel is a last resort**, not a default. It is appropriate only when the content is long-form prose the user will copy elsewhere, or for failure diagnostics when no richer surface is available.

2. **Webview panels require visual structure** — charts, sortable tables, filter bars. Do not open a panel for plain text or a list that would fit in a tree.

3. **Tree expansion** is appropriate when the parent entity already exists in the tree and the result is an ordered child sequence (workflow steps, scan files, dead-code issues). The tree provides persistent, navigable state that the output channel cannot.

4. **Chat output only when the trigger was chat.** Commands dispatched from the panel, command palette, or keyboard shortcuts do not push results to the chat stream. This is enforced structurally: `specialized-commands.ts` owns the panel/palette path; `chat-participant.ts` owns the chat path. They do not share a result surface.

5. **"Show Output" error button is mandatory** whenever the command's happy path writes to the output channel. If the output channel contains the diagnostic detail, errors must offer to reveal it. Fixed centrally in `command-registry.ts` — not per-command.

### Scope

Applies to all new commands. Existing commands are migrated incrementally, prioritized by user-facing impact. Commands not yet migrated are not violations — they are backlog items.

### Known existing non-compliance

- `git.resolveConflicts` — structured per-file data rendered in the output channel; maps to tree expansion per this matrix. Medium priority, no immediate user impact.
- `chat.delegate` — falls back to `formatResultMessage` for commands without a dedicated formatter. Addressed by adding `RESULT_FORMATTERS` entries per dispatched command.

---

## Consequences

**Good:**
- New commands have a clear, documented answer for "where does this result go?"
- Tree expansion provides persistent, interactive step detail without webview infrastructure cost.
- Centralizing the error-surface fix in `command-registry.ts` means all future commands get "Show Output" for free.
- Chat formatters are decoupled from dispatch logic — adding a formatter requires touching only `RESULT_FORMATTERS` in `chat-participant.ts`.

**Watch out:**
- Do not add webview panels for data that has no chart or table structure. The cost of HTML/JS/CSS is only justified when the data benefits from visual encoding.
- Do not write to the output channel for results that belong in the tree. The channel is ephemeral — scrolled away and forgotten. Tree state persists across the session.
- Do not push results to chat from non-chat trigger paths. Users who invoke commands from the panel or keyboard do not expect their chat panel to open.

---

## Reference

- `src/presentation/result-presenters.ts` — ok-path formatter per command
- `src/presentation/command-registry.ts` — dispatch loop, error path (centralized "Show Output")
- `src/presentation/specialized-commands.ts` — panel/palette trigger path for specialized commands
- `src/ui/chat-participant.ts` — chat trigger path, `RESULT_FORMATTERS`
- `src/ui/tree-providers/` — tree panel expansion implementations
- `src/infrastructure/webview-provider.ts` — `BaseWebviewProvider<T>` for webview panels
