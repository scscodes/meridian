# ADR 003 — Single NL Classification Authority

**Date**: 2026-03-04
**Status**: Accepted

---

## Context

The chat participant originally ran its own inline LLM classifier alongside the `chat.delegate` handler's classifier. They diverged immediately: different command manifests, different prompts, different fallback behavior. Every new command required updating two places, and they got out of sync within a sprint. Keyword maps were introduced as a shortcut, adding a third path that silently bypassed the LLM entirely.

---

## Decision

All natural language input routes through `router.dispatch("chat.delegate", { task })`. The `chat.delegate` handler owns classification — the prompt (registry ID: `DELEGATE_CLASSIFIER`) and the valid command set (`KNOWN_COMMANDS`). The chat participant does zero classification; it dispatches and formats.

**Adding a new command means updating exactly two places:**
1. `KNOWN_COMMANDS` in `src/domains/chat/handlers.ts`
2. One line in the `DELEGATE_CLASSIFIER` prompt (in `src/infrastructure/prompt-registry.ts`) describing when to select it

Nowhere else. Not in `chat-participant.ts`. Not in a keyword map. Not in a switch statement.

**Slash commands** are exact-match shortcuts only — they dispatch directly without classification. They are not a mechanism for routing NL input.

Do NOT add keyword maps, shortcut maps, or inline classifiers to `chat-participant.ts`. Ever.

---

## Consequences

**Good:**
- Single source of truth for command routing. All chat surfaces (participant, LM tools, workflows) get identical classification behavior.
- Regression surface shrinks: one prompt to audit, one command list to maintain.

**Watch out:**
- `KNOWN_COMMANDS` must stay current. A command added to `COMMAND_MAP` but omitted from `KNOWN_COMMANDS` is unreachable via chat — silently.
- Classifier prompt quality is critical. Vague descriptions produce misclassification. Keep entries specific.

---

## Reference

- `src/ui/chat-participant.ts` — dispatch-only routing
- `src/domains/chat/handlers.ts` — `KNOWN_COMMANDS`
- `src/infrastructure/prompt-registry.ts` — `DELEGATE_CLASSIFIER` prompt
