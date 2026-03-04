# Meridian — Roadmap

See [FEATURES.md](./FEATURES.md) for the complete feature inventory.

---

## Architecture

Meridian is built on Domain-Driven Design with composable command routing:

- **CommandRouter** — Typed command dispatch through middleware chain (telemetry, logging, validation)
- **Domain services** — Five domains (Git, Hygiene, Chat, Workflow, Agent) register handlers at startup
- **Result monad** — `{kind: "ok"|"err"}` for explicit error handling; no thrown exceptions in normal flow
- **Prose generation** — Shared `<context> → analyze → synthesize prose` primitive via `GenerateProseFn` DI
- **Workflow engine** — JSON-defined step sequences with conditionals, variable interpolation, output chaining

---

## Next Phase

### Chat — NL-First Participant Refactor

**Goal**: Make natural language the primary interaction surface for `@meridian`. Slash commands become accelerators, not the primary path.

**Current problem**: Intent classification order is `slash → keyword map → LLM classifier → chat.context fallback`. The LLM classifier does real work but sits at position 3. Keyword map is a leaky abstraction that will rot as commands grow.

**Target architecture**:
1. Slash commands — exact match shortcuts, direct dispatch (keep all 10 existing)
2. Natural language → `chat.delegate` — single classification authority, eliminates dual-classifier problem
3. LM tools — expanded surface so Copilot agent mode can autonomously chain commands

**Current state (from deep dive):**

| Layer | Gap |
|-------|-----|
| Keyword map (17 entries) | Leaky middle layer — bypasses LLM, will rot as commands grow |
| `chat.delegate` KNOWN_COMMANDS | Missing: `hygiene.impactAnalysis`, `agent.execute`, `hygiene.cleanup`, `hygiene.showAnalytics` — partially closed last session |
| LM tools (7 registered) | Missing: `git.generatePR`, `git.reviewPR`, `git.commentPR`, `git.resolveConflicts`, `git.sessionBriefing`, `hygiene.impactAnalysis`, `agent.execute` |
| Unreachable via any chat surface | `git.exportJson`, `git.exportCsv` |

**Tasks (in order):**

1. ~~**Route NL through `chat.delegate`**~~ — Done. Chat participant NL path now routes through `router.dispatch("chat.delegate")`. Inline classifier and `VALID_COMMANDS` deleted. `formatCommandResult()` extracted as shared formatter. `workflow.run:<name>` prefix parsing added to delegate handler.

2. **Expand `chat.delegate` KNOWN_COMMANDS** — Add `hygiene.impactAnalysis`, `agent.execute`, `hygiene.cleanup`, `hygiene.showAnalytics`. Update the classification system prompt to describe each. Mirror changes in `VALID_COMMANDS` in chat-participant.ts.

3. **Drop the keyword map** — Remove `KEYWORD_MAP` from chat-participant.ts. Single-word queries ("status", "scan", "agents") are handled correctly by the classifier; the map adds no value and diverges over time.

4. **Add `/impact` slash command** — `package.json` chatParticipants entry + `SLASH_MAP` entry + result formatter in `handleDirectDispatch` (prompts for file path via the active editor, matching the keybinding behavior).

5. **Expand LM tools** — Add the 7 missing tools to `TOOL_DEFS` in `lm-tools.ts` and corresponding `languageModelTools` declarations in `package.json`. Prose tools (`generatePR`, `reviewPR`, etc.) return their prose as the tool result text. `hygiene.impactAnalysis` accepts `filePath` and `functionName` as input schema params.

6. **Generalize result formatter** — `handleDirectDispatch` currently has hardcoded per-command formatting. Extract to a command→formatter map so adding new commands doesn't require touching the dispatch logic.

---

## Deferred

- Canonical config service — internal cleanup, zero user value
- Remote telemetry sink — no destination exists
- Additional analytics chart types — diminishing returns on existing webviews
