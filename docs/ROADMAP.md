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

**Completed.** All 6 tasks done. Final architecture:

1. Slash commands → `SLASH_MAP` direct dispatch (11 commands including `/impact`)
2. `"run <name>"` shorthand → `workflow.run` dispatch
3. All other NL → `chat.delegate` (single classification authority via `DELEGATE_CLASSIFIER_PROMPT` + `KNOWN_COMMANDS`)
4. 14 LM tools registered for Copilot agent mode autonomous chaining
5. `RESULT_FORMATTERS` map — adding new command formatters requires one map entry, not dispatch logic changes

**Remaining gap**: `git.exportJson` and `git.exportCsv` are not reachable via chat (export commands — low priority).

---

## Deferred

- Canonical config service — internal cleanup, zero user value
- Remote telemetry sink — no destination exists
- Additional analytics chart types — diminishing returns on existing webviews
