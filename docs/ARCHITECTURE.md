# Meridian Architecture

**Design Pattern**: Domain-Driven Design (DDD) with Aiogram-style Command Router
**Philosophy**: Structure over features, explicit types, no magic, Result monad for error handling

---

## Overview

Meridian implements a layered VS Code extension architecture:

1. **Command Router** (`router.ts`) — centralized registry; dispatches typed commands through a middleware chain
2. **Domain Services** (`domains/`) — isolated, testable business logic; five domains (git, hygiene, chat, workflow, agent)
3. **Infrastructure Layer** (`infrastructure/`) — typed wrappers for external systems (git CLI, VS Code API, workspace, LLM)
4. **Workflow Engine** (`workflow-engine.ts`) — linear step executor with conditional branching and output passing
5. **Agent Registry** (`agent-registry.ts`) — local agent definition discovery and validation
6. **Result Monad** — `{kind: "ok"|"err"}` throughout; no exceptions in normal flow

### Design Principles

1. **No Magic** -- All strings are typed constants, explicit configuration
2. **Result Monad** -- Errors surfaced explicitly, no exceptions in normal flow
3. **Dependency Injection** -- Services receive dependencies, fully testable
4. **Middleware Chain** -- Cross-cutting concerns applied declaratively
5. **Handler Registration** -- Commands validated at startup, not at call time
6. **Tool Export** -- Domains expose tools for external orchestration
7. **Subagent Delegation** -- Background tasks spawn agents, capture results
8. **Clear Boundaries** -- Each domain owns its schema, no type leaks

---

## Architecture Layers

### 1. Core (`src/`)

- **`types.ts`** — `Result<T>`, `Command`, `CommandName`, `Handler<P,R>`, `DomainService`, infrastructure abstractions, workflow/agent schemas
- **`router.ts`** — register domains, execute middleware chain, dispatch to handlers, teardown on deactivation
- **`main.ts`** — activate domains, wire middleware, expose VS Code commands via `COMMAND_MAP`
- **`constants.ts`** — centralized thresholds (`CACHE`, `GIT`, `HYGIENE`, `ANALYTICS`, `UI_SETTINGS`)

### 2. Domains (`src/domains/`)

Each domain is isolated, owns its command namespace, and exports:
- `handlers.ts` — command handler factories (`createXxxHandler(providers, logger)`)
- `service.ts` — `DomainService` impl with `initialize()` / `teardown()`
- `types.ts` — domain-specific types
- `index.ts` — public API

#### Git (`git/`)
Commands: `git.status`, `git.pull`, `git.commit`, `git.smartCommit`, `git.analyzeInbound`, `git.showAnalytics`, `git.exportJson`, `git.exportCsv`, `git.generatePR`, `git.reviewPR`, `git.commentPR`, `git.resolveConflicts`, `git.sessionBriefing`

Notable: `smart-commit-handler.ts` orchestrates multi-step approval UI → batch commit → rollback. Analytics via `analytics-service.ts` + Chart.js webview.

#### Hygiene (`hygiene/`)
Commands: `hygiene.scan`, `hygiene.cleanup`, `hygiene.impactAnalysis`, `hygiene.showAnalytics`

Notable: `dead-code-analyzer.ts` uses TypeScript Compiler API for unused export / unreferenced file detection. `impact-analysis-handler.ts` traces blast radius via TS Compiler API + LLM prose.

#### Chat (`chat/`)
Commands: `chat.context`, `chat.delegate`

`chat.delegate` is the programmatic router: LLM classifies a free-form task string into a command via the prompt registry (`DELEGATE_CLASSIFIER`), then dispatches. The chat UI (`ui/chat-participant.ts`) routes independently via `SLASH_MAP` → LLM classifier → fallback.

### NL Orchestration Layer

#### Chat Participant Routing (`ui/chat-participant.ts`)

The `@meridian` chat participant implements four-tier routing, checked in strict priority order:

1. **`request.command`** — VS Code routes `/status`, `/scan`, `/impact`, etc. directly here (no leading slash). Matched against `SLASH_MAP` for immediate dispatch with no LLM call.
2. **`SLASH_MAP` keyword match** — explicit `/keyword` in the raw prompt text (legacy fallback for clients that don't surface `request.command`).
3. **`"run <name>"` shorthand** — dispatches `workflow.run` with the extracted workflow name; zero LLM calls.
4. **`chat.delegate`** — falls through to the single classification authority: `chat.delegate` calls the LLM with the `DELEGATE_CLASSIFIER` prompt, gets back a `CommandName` (or `workflow.run:<name>`), then dispatches. This is the only tier that invokes the LLM.

Empty prompts fall back to a help message listing all available slash commands. The `/impact` command auto-populates `filePath` from the active editor; if no file is open it surfaces a user-friendly message rather than dispatching.

See ADR 003 (`docs/adr/003-single-classifier.md`) for the rationale behind keeping classification in a single authority (`chat.delegate`) rather than distributing it across tiers.

#### LM Tools (`ui/lm-tools.ts`)

`registerMeridianTools()` wraps every entry in `TOOL_DEFS` as a `vscode.lm.registerTool()` call. Each tool:
1. Receives `options.input` as params (typed `Record<string, unknown>`).
2. Calls `router.dispatch({ name: commandName, params }, ctx)`.
3. Returns a `LanguageModelToolResult` with the formatted message from `formatResultMessage()`.

Tools share the same `CommandRouter` instance as VS Code commands and the chat participant — ensuring consistent middleware (observability, audit) and a single handler registry. Adding a new tool only requires an entry in `TOOL_DEFS` and `contributes.languageModelTools` in `package.json`.

#### Workflow and Agent Composition

Workflows (`.vscode/workflows/*.json`) compose commands linearly via the same `router.dispatch()` path as all other callers. The `StepRunner` passed to the workflow engine is a closure over the router, so workflows can chain any registered command including `chat.delegate` (enabling LLM-driven steps within a workflow).

Agents (`.vscode/agents/*.json`) declare capability lists (`capabilities: CommandName[]`) validated at load time. `AgentExecutor` dispatches each capability command through the router, then synthesises a structured result. Agents can also reference workflows by name, composing multi-step plans without additional orchestration code.

#### Workflow (`workflow/`)
Commands: `workflow.list`, `workflow.run`

JSON-defined workflows in `.vscode/workflows/`. Steps execute linearly with `onSuccess`/`onFailure` branching, variable interpolation, and output passing.

#### Agent (`agent/`)
Commands: `agent.list`, `agent.execute`

JSON-defined agents in `.vscode/agents/`. Capability validation before execution. `AgentExecutor` dispatches to command or workflow with structured result reporting.

### 3. Infrastructure (`src/infrastructure/`)

| File | Purpose |
|------|---------|
| `logger.ts` | Structured in-memory logger; levels DEBUG/INFO/WARN/ERROR |
| `telemetry.ts` | `TelemetryTracker` with pluggable sinks; wired as middleware |
| `git-provider.ts` | Real git CLI wrapper via async `execFile` |
| `workspace-provider.ts` | Real `fs/promises` file operations |
| `workspace.ts` | Workspace root detection, `.vscode/` path resolution |
| `webview-provider.ts` | `WebviewViewProvider` for analytics panels |
| `workflow-engine.ts` | Step execution engine with branching and output passing |
| `agent-registry.ts` | Agent discovery, schema validation, capability queries |
| `result-handler.ts` | `Result<T>` → VS Code notification + OutputChannel |
| `model-selector.ts` | Reads `meridian.model.*` settings to select LLM per domain |
| `error-codes.ts` | Centralized error codes, telemetry event enum, timeouts |

### 4. UI (`src/ui/`)

- `chat-participant.ts` — `@meridian` participant; multi-tier routing: slash commands → LLM classifier → fallback
- `lm-tools.ts` — registers commands as VS Code LM tools for Copilot agent mode
- `smart-commit-quick-pick.ts` — QuickPick group selection + InputBox per group
- `tree-providers/` — sidebar views (git, hygiene, workflow, agent)

### 5. Cross-Cutting (`src/cross-cutting/`)

- `middleware.ts` — logging, audit, rate-limit, permission middleware factories

---

## Key Patterns

**Result monad** — every failable operation returns `Result<T>`; checked at each call site, never swallowed.

**DI via constructor** — handlers receive `(gitProvider, logger, ...)` as arguments; fully mockable in tests.

**`createXxxDomain()` factory** — each domain exports a factory that wires providers into a `DomainService`; registered in `main.ts` via `router.registerDomain()`.

**Startup validation** — `router.validateDomains()` runs all `initialize()` methods before the extension reports ready; fail-fast on misconfiguration.

**Rendering Surface Decision Matrix** (ADR 006) — surface choice is determined by output shape and trigger source, not command domain. The matrix:
- Structured multi-entity reports (analytics) → Webview panel
- Ordered step sequences with per-item pass/fail → Tree panel expansion
- Long-form prose (PR body, briefing, conflict resolution) → Output channel + clipboard
- Short scalar/status → Toast or chat inline
- NL-triggered results (chat path) → Chat markdown

The output channel is a last resort. All commands whose happy path writes to the output channel must offer a "Show Output" error button — enforced centrally in `command-registry.ts`.

**`RESULT_FORMATTERS` pattern** — `src/ui/chat-participant.ts` maintains a `Partial<Record<CommandName, ResultFormatter>>` map. Adding chat output for a new command requires only a new entry in this map; no changes to dispatch logic. This decouples display strategy from routing.

**WorkflowTreeProvider step expansion** (ADR 007) — after `workflow.run` completes, `WorkflowTreeProvider` stores `stepResults: StepResult[]` per workflow in `lastRuns`. Items become `TreeItemCollapsibleState.Collapsed`; `getChildren` returns `WorkflowStepTreeItem` children with `pass`/`error` ThemeIcons. The provider is wired to both the panel path (`specialized-commands.ts`) and the chat path (`chat-participant.ts`) via `setRunning`/`setLastRun` callbacks.

---

## Error Handling

All errors use `AppError { code, message, details?, context? }`. Error codes are defined in `error-codes.ts`. Messages must be actionable — describe the failure and how to diagnose it. See handler implementations for canonical examples.

---

## Extension Points

- **New domain**: create `src/domains/<name>/`, add `CommandName` union entries, implement handlers + service, register in `main.ts`
- **New middleware**: implement `Middleware` interface, add to `router.use()` chain in `main.ts`
- **New workflow**: drop `.vscode/workflows/<name>.json`; available immediately via `workflow.list`/`workflow.run`
- **New agent**: drop `.vscode/agents/<id>.json`; available immediately via `agent.list`/`agent.execute`
- **New LM tool**: add to `TOOL_DEFS` in `lm-tools.ts` and `contributes.languageModelTools` in `package.json`

---

## File Structure

```
src/
├── main.ts                          # Entry point, domain registration, command wiring
├── types.ts                         # Core types, Result monad
├── router.ts                        # CommandRouter implementation
├── constants.ts                     # Centralized constants, thresholds, settings
├── domains/
│   ├── git/                         # Git operations + analytics + PR utilities
│   ├── hygiene/                     # Workspace scan, cleanup, impact analysis
│   ├── chat/                        # Context gathering, chat.delegate router
│   ├── workflow/                    # Workflow discovery + execution
│   └── agent/                      # Agent discovery + execution
├── infrastructure/                  # Typed wrappers for external systems
├── ui/
│   ├── chat-participant.ts          # @meridian chat participant
│   ├── lm-tools.ts                  # LM tool registrations
│   ├── smart-commit-quick-pick.ts
│   └── tree-providers/              # Sidebar views (git, hygiene, workflow, agent)
└── cross-cutting/
    └── middleware.ts
```

---

## Type Safety

TypeScript strict mode is enforced project-wide:

```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "noUnusedLocals": true,
  "noImplicitReturns": true
}
```

All handler signatures are explicitly typed:

```typescript
export type Handler<P = unknown, R = unknown> = (
  ctx: CommandContext,
  params: P
) => Promise<Result<R>>;
```

Command names use a discriminated union:

```typescript
export type CommandName =
  | "git.status" | "git.pull" | "git.commit"
  | "hygiene.scan" | "hygiene.cleanup"
  | "chat.context" | "chat.delegate"
  // ... additional commands per domain
```

---

## Middleware Stack

Middleware is executed in registration order before the handler:

1. **LoggingMiddleware** -- Tracks command execution time, logs start/end
2. **AuditMiddleware** -- Logs mutations (git, cleanup, delegation)
3. **ObservabilityMiddleware** -- Unified logging + telemetry in a single timing pass
4. (Custom: PermissionMiddleware, RateLimitMiddleware)
5. **Handler** -- Business logic

```typescript
router.use(createObservabilityMiddleware(logger, telemetry));
router.use(createAuditMiddleware(logger));
// Executed in order before handler dispatch
```

---

## Command Dispatch

### Registration (Validated at Startup)

```typescript
const router = new CommandRouter(logger);
const gitDomain = createGitDomain(gitProvider, logger);
router.registerDomain(gitDomain);
await router.validateDomains(); // All handlers initialized
```

### Dispatch (with Middleware Chain)

```typescript
const result = await router.dispatch(
  { name: "git.status", params: { branch: "main" } },
  context
);

if (result.kind === "ok") {
  console.log(result.value); // GitStatus
} else {
  console.error(result.error); // AppError
}
```

---

## Testing

### Unit Tests (Handlers)

```typescript
const mockGit = { status: vi.fn().mockResolvedValue(...) };
const handler = createStatusHandler(mockGit, logger);
const result = await handler(ctx, {});
expect(result.kind).toBe("ok");
```

### Integration Tests (Router + Domains)

```typescript
const router = new CommandRouter(logger);
router.registerDomain(createGitDomain(mockGit, logger));
const result = await router.dispatch({ name: "git.status", params: {} }, ctx);
```

Test framework: Vitest. Tests live in `tests/` and mock at boundaries (providers, VS Code API).

---

## Dependencies

**Runtime**: `micromatch` (glob matching for ignore patterns)

**Development**: `typescript`, `vitest`, `@types/vscode`, `@types/node`

---

**References**: [VS Code Extension API](https://code.visualstudio.com/api) · [Contribution Points](https://code.visualstudio.com/api/references/contribution-points)
