# Meridian — Roadmap

## Architecture

Meridian is a VS Code extension built on DDD + Aiogram-style command routing:

- **CommandRouter** dispatches typed commands through a middleware chain (telemetry, logging, audit)
- **Domain services** (Git, Hygiene, Chat, Workflow, Agent) register handlers at startup
- **Result monad** (`{kind: "ok"|"err"}`) for explicit error handling — no thrown exceptions in normal flow
- **Workflow engine** executes JSON-defined step sequences with conditional branching + variable interpolation
- **Agent registry** discovers local agent definitions from `.vscode/agents/`

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
| Hygiene — scan/cleanup | Real | Multi-category fs scan, dead code via TS Compiler API, safe deletion |
| Hygiene — analytics | Real | File categorization, temporal bucketing, prune recommendations |
| Chat / Copilot | Wired | Chat participant, LLM classifier, slash commands, keyword map, LM tools |
| Workflow engine | Real | Step execution, conditionals, variable interpolation, output passing |
| Agent registry | Minimal | JSON discovery + capability queries. No execution |
| Telemetry | Wired | ConsoleTelemetrySink as middleware. No remote sink |
| UI — Sidebar | Done | 4 tree providers (git, hygiene, workflow, agent) with auto-refresh via FileSystemWatcher |
| UI — Webviews | Done | Git analytics + hygiene analytics (Chart.js) |
| UI — Output/Notifications | Done | OutputChannel + result-handler.ts for info/warn/error toasts |
| UI — Status Bar | Done | Branch + dirty indicator, QuickPick action menu, auto-updates on git state changes |
| UI — Menus/Keybindings | Done | Explorer context menus, command palette when-clauses, chord keybindings |
| Tests | Solid | 14 test files, 123 tests covering router, result monad, workflow engine, all git subsystems |
| Constants | Solid | Centralized in `constants.ts` — no magic numbers |

### UI/UX Phase — Complete

All 6 groups shipped:

1. **Command wiring + result surfacing** — COMMAND_MAP loop, OutputChannel, notification toasts
2. **Sidebar tree providers** — git, hygiene, workflow, agent views in activity bar
3. **Webview analytics panels** — Chart.js visualizations for git + hygiene
4. **Chat / Copilot integration** — multi-tier intent classification, LM tool definitions
5. **SmartCommit approval UI** — QuickPick group selection + InputBox message editing
6. **Menus, keybindings, context clauses** — explorer context menus, chord bindings, when-clauses
7. **FileSystemWatcher + Status Bar** — auto-refresh tree views, persistent branch/status indicator

---

## Technical Debt

Known bugs in `src/domains/git/analytics-service.ts` that affect analytics accuracy:

### 1. `matchesPathPattern` is a stub

**Location:** `analytics-service.ts` ~line 234

The `pathPattern` option in `AnalyticsOptions` is accepted but silently ignored — the filter dropdown in the analytics UI has no effect. Fix: iterate `commit.files` and match via `micromatch.isMatch` (already imported).

### 2. Trend normalization uses fixed divisor

**Location:** `analytics-service.ts` ~line 346, `constants.ts` (`ANALYTICS_SETTINGS.TREND_NORMALIZE_WEEKS`)

Commit trend splits into two halves and divides each by a fixed `4` weeks regardless of actual period. A 3-month window and 12-month window both use the same divisor. Absolute values are meaningless; thresholds break across periods. Fix: compute actual weeks from `since`/`until` dates.

### 3. Week bucketing uses week-of-month, not ISO week

**Location:** `analytics-service.ts` ~line 448

`Math.ceil(date.getDate() / 7)` produces 1–5 (week within month). Commits in the same calendar week but different months get different bucket keys, fragmenting the frequency chart. Fix: use ISO 8601 week number calculation.

### 4. `chat.delegate` unreachable from chat UX

Backend handler exists but no chat participant route maps to it. Low priority — the routing infra works, just needs a keyword/slash entry.

---

## Next Phase: Analysis-to-Prose Pipeline

### The Pattern

The highest-value features Meridian can ship next all share a common design:

```
<context> → analyze → synthesize prose
```

PR descriptions, PR reviews, conflict resolution, session recovery, worktree monitoring — they're all the same pipeline with different inputs and output templates. Build the pattern once as a reusable primitive, then stamp out features.

**Core primitive:** A function that takes structured analysis output (from any domain) and an LLM prompt template, then produces formatted prose via the VS Code Language Model API. This sits in `src/infrastructure/` and any domain can call it.

### Priority Features

#### Tier 1 — Builds directly on existing infrastructure

**1. PR Description Generator** (`git.generatePR`) — **SHIPPED**
- Prose primitive (`src/infrastructure/prose-generator.ts`) + first consumer
- `generateProse()` / `streamProse()` — reusable by all future consumers
- `GenerateProseFn` injected via DI to keep domain layer free of `vscode` imports
- Output: Markdown to clipboard + OutputChannel display
- Keybinding: `Ctrl+M Ctrl+P`

**2. PR Review** (`git.reviewPR`) — **SHIPPED**
- Uses `gatherPRContext()` → JSON-structured prompt → parsed verdict + per-file comments
- Output: OutputChannel + clipboard. Keybinding: `Ctrl+M Ctrl+V`

**3. PR Comments** (`git.commentPR`) — **SHIPPED**
- Uses `gatherPRContext()` → JSON-structured prompt → inline comments with optional line refs
- Supports `paths` filter for scoping to specific files
- Output: OutputChannel + clipboard. Keybinding: `Ctrl+M Ctrl+I`

**4. Conflict Resolution Assistant** (`git.resolveConflicts`) — **SHIPPED**
- Uses `InboundAnalyzer.analyze()` + per-conflict `gitProvider.diff()` for actual file diffs
- Produces per-file strategy (keep-ours/keep-theirs/manual-merge/review-needed) with rationale
- Output: OutputChannel. Keybinding: `Ctrl+M Ctrl+X`

**5. Session Context Recovery** (`meridian.sessionBriefing`)
- Input: git status + last N commits + stale branches + uncommitted changes + open TODOs
- Analysis: Aggregate from existing git.status + git.analytics + hygiene.scan
- Prose: "Morning briefing" — where you left off, what's pending, what needs attention
- Output: Webview panel or OutputChannel on workspace open
- Why: Eliminates the 10-15 min "where was I?" tax after context switches

### Implementation Notes — Git Prose Consumers (2-4)

**Infrastructure built:**
- `gatherPRContext()` — shared context gather used by generatePR, reviewPR, commentPR
- `parseFileChanges()` — exported helper for domain/fileType metadata
- All handlers conditionally wired in `GitDomainService` when `generateProseFn` is provided
- JSON-structured prompts with text fallback parsing for all consumers

**GitProvider gaps** (not blocking, needed for accuracy):
- `getCommitRange(base, head)` — branch-scoped commits (vs. global `getRecentCommits(N)`)
- Merge-base detection — `getDiff()` returns working-tree diff, not `merge-base..HEAD`
- `estimateChanges()` in InboundAnalyzer is a stub — returns hashed values, not real stats

#### Tier 2 — New capabilities

**5. Pre-built Workflow Templates**
- Ship 4-5 built-in workflows: "Start Feature Branch", "Pre-Push Checks", "Morning Sync", "Prepare PR"
- Makes the workflow sidebar immediately useful instead of empty
- Each workflow chains existing Meridian commands — no new handlers needed

**6. Code Impact Analysis** (`hygiene.impactAnalysis`)
- Input: A file path or function name
- Analysis: TS Compiler API (already used for dead code) to trace imports, references, test coverage
- Prose: "Changing this file affects 4 importers and 2 test files. Blast radius: medium."
- Why: No other extension surfaces this as a one-click operation

**7. Agent Execution**
- Agents currently only have metadata — no execution capability
- Make agents callable: run shell commands, chain Meridian commands, report results
- Example: a "code reviewer" agent that runs hygiene scan + dead code + analytics and produces a summary

### Deferred

These are real but low-leverage right now:

- Canonical config service (internal cleanup, zero user value)
- Remote telemetry sink (no destination exists)
- Additional analytics chart types (diminishing returns)
- `chat.delegate` routing (solving a problem nobody has yet)
