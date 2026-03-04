# Meridian — Roadmap

## Architecture

Meridian is a VS Code extension built on DDD + Aiogram-style command routing:

- **CommandRouter** dispatches typed commands through a middleware chain (telemetry, logging, audit)
- **Domain services** (Git, Hygiene, Chat, Workflow, Agent) register handlers at startup
- **Result monad** (`{kind: "ok"|"err"}`) for explicit error handling — no thrown exceptions in normal flow
- **Workflow engine** executes JSON-defined step sequences with conditional branching + variable interpolation
- **Agent registry** discovers local agent definitions from `.vscode/agents/`

### Git Domain File Layout

The git domain was decomposed from two monolith files into focused modules:

| File | Responsibility |
|------|---------------|
| `service.ts` | `GitDomainService` orchestrator only — wires components + handlers |
| `smart-commit-service.ts` | `ChangeGrouper`, `CommitMessageSuggester`, `BatchCommitter` |
| `inbound-analyzer.ts` | `InboundAnalyzer` — remote diff, conflict detection, severity scoring |
| `handlers.ts` | Basic git ops: status, pull, commit |
| `smart-commit-handler.ts` | `createSmartCommitHandler` — approval flow orchestration |
| `pr-handlers.ts` | `generatePR`, `reviewPR`, `commentPR`, `resolveConflicts` + `gatherPRContext` |
| `session-handler.ts` | `git.sessionBriefing` — morning briefing prose consumer |
| `inbound-handler.ts` | `createAnalyzeInboundHandler` |
| `analytics-service.ts` | `GitAnalyzer` — commit frequency, churn, trends |
| `analytics-handler.ts` | Analytics webview + export handlers |

Hygiene domain: `handlers.ts` deleted; replaced with `scan-handler.ts` + `cleanup-handler.ts`.

---

## Current State

### Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| CommandRouter + Middleware | Solid | Registration, dispatch, validation, teardown, middleware chain |
| Result monad / error handling | Solid | Centralized error codes in `error-codes.ts` |
| Git — core commands | Real | Async `execFile` — status, pull, commit, diff, log, stage, reset |
| Git — SmartCommit | Real | ChangeGrouper + CommitMessageSuggester + BatchCommitter with rollback |
| Git — InboundAnalyzer | Real | Fetch, diff, conflict detection, severity scoring, diff link generation |
| Git — Analytics | Real | Commit frequency, churn, author analysis, volatility, trend detection |
| Git — PR Description | Real | `git.generatePR` — branch diff → markdown PR body via LLM. `Ctrl+M Ctrl+P` |
| Git — PR Review | Real | `git.reviewPR` — verdict + per-file comments via LLM. `Ctrl+M Ctrl+V` |
| Git — PR Comments | Real | `git.commentPR` — inline comments with optional line refs. `Ctrl+M Ctrl+I` |
| Git — Conflict Resolution | Real | `git.resolveConflicts` — per-file strategy (keep/merge/review) via LLM. `Ctrl+M Ctrl+X` |
| Git — Session Briefing | Real | `git.sessionBriefing` — branch state + recent commits + uncommitted changes via LLM. `Ctrl+M Ctrl+B` |
| Hygiene — scan/cleanup | Real | Multi-category fs scan, dead code via TS Compiler API, safe deletion |
| Hygiene — analytics | Real | File categorization, temporal bucketing, prune recommendations |
| Chat / Copilot | Real | Chat participant, LLM classifier, slash commands (`/pr` `/review` `/briefing` `/conflicts` + 6 others), keyword map, LM tools, `chat.delegate` programmatic router |
| Workflow engine | Real | Step execution, conditionals, variable interpolation, output passing |
| Agent registry | Minimal | JSON discovery + capability queries. No execution |
| Telemetry | Wired | ConsoleTelemetrySink as middleware. No remote sink |
| UI — Sidebar | Done | 4 tree providers (git, hygiene, workflow, agent) with auto-refresh via FileSystemWatcher |
| UI — Webviews | Done | Git analytics + hygiene analytics (Chart.js) |
| UI — Output/Notifications | Done | OutputChannel + result-handler.ts for info/warn/error toasts |
| UI — Status Bar | Done | Branch + dirty indicator, QuickPick action menu, auto-updates on git state changes |
| UI — Menus/Keybindings | Done | Explorer context menus, command palette when-clauses, chord keybindings |
| Tests | Solid | 15 test files, 127 tests covering router, result monad, workflow engine, all git subsystems, chat.delegate |
| Constants | Solid | Centralized in `constants.ts` — no magic numbers |

### Prose Pipeline — Complete

All Tier 1 prose consumers shipped. The `<context> → analyze → synthesize prose` primitive is established in `src/infrastructure/prose-generator.ts` with `GenerateProseFn` injected via DI to keep domain code free of `vscode` imports.

`git.sessionBriefing` now surfaces correctly in the OutputChannel with clipboard copy (latent bug fixed). `chat.delegate` is wired as a programmatic task router — LLM classifies free-form tasks and dispatches the matching command. All prose commands are reachable from `@meridian` via `/pr`, `/review`, `/briefing`, `/conflicts` slash commands and natural language.

**Shipped consumers:**

1. `git.generatePR` — branch diff → structured PR body
2. `git.reviewPR` — `gatherPRContext()` → verdict + per-file comments
3. `git.commentPR` — `gatherPRContext()` → inline comments with optional line refs
4. `git.resolveConflicts` — `InboundAnalyzer` + per-conflict diff → per-file merge strategy
5. `git.sessionBriefing` — branch state + recent commits + uncommitted changes → morning briefing

**Shared infrastructure:**
- `gatherPRContext()` in `pr-handlers.ts` — branch, commits, diff aggregation (now merge-base accurate)
- `parseFileChanges()` — domain/fileType metadata extraction
- All prose handlers conditionally wired in `GitDomainService` when `generateProseFn` is provided
- JSON-structured prompts with text fallback parsing throughout

**GitProvider accuracy (shipped):**
- `getMergeBase(branch, base)` added to interface + impl — `gatherPRContext` now uses true merge-base
- `estimateChanges()` in `InboundAnalyzer` replaced — now calls `git diff --numstat` for real counts

---

## Next Phase

### Priority Stack (highest ROI first)

**1. ~~Pre-built Workflow Templates~~ — Done**
- 6 bundled workflows in `bundled/workflows/`: `morning-sync`, `prepare-pr`, `pre-push-checks`, `sync-repo`, `lint-and-commit`, `scan-then-cleanup`
- Sidebar is now useful on first install

**5. Code Impact Analysis** (`hygiene.impactAnalysis`) — Medium ROI, high novelty
- Input: file path or function name
- TS Compiler API (already in use for dead code) traces imports, call sites, test coverage
- Prose output: blast radius summary — "Changing this affects 4 importers and 2 test files"
- No other extension surfaces this as a one-click operation

**6. Agent Execution** — Lower ROI until templates are established
- Agents currently have metadata only; no execution path
- Make agents callable: shell commands + chained Meridian commands + result reporting
- Natural fit once workflow templates exist to act as agent step definitions

### Deferred

- Canonical config service — internal cleanup, zero user value
- Remote telemetry sink — no destination exists
- Additional analytics chart types — diminishing returns on existing webviews
