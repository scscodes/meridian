# Meridian POC

**Domain-Driven Design (DDD) architecture for VS Code extensions.**

A production-ready scaffold demonstrating:
- **Command Router** (Aiogram-style pattern)
- **Explicit types, no magic** (TypeScript strict mode)
- **Result monad error handling** (Either<Error, Success>)
- **Domain isolation** (Git, Hygiene, Chat/Copilot)
- **Cross-cutting middleware** (logging, auth, audit)

---

## Directory Structure

```
meridian/
├── src/
│   ├── main.ts                  # Extension entry point (activate/deactivate)
│   ├── types.ts                 # Core interfaces & Result monad
│   ├── router.ts                # CommandRouter with middleware chain
│   ├── domains/
│   │   ├── git/
│   │   │   ├── handlers.ts      # git.status, git.pull, git.commit
│   │   │   └── service.ts       # GitDomainService
│   │   ├── hygiene/
│   │   │   ├── handlers.ts      # hygiene.scan, hygiene.cleanup
│   │   │   └── service.ts       # HygieneDomainService
│   │   └── chat/
│   │       ├── handlers.ts      # chat.context, chat.delegate
│   │       └── service.ts       # ChatDomainService (integration)
│   ├── infrastructure/
│   │   ├── logger.ts            # Structured logging (no console.log)
│   │   ├── config.ts            # Typed config schema
│   │   └── git-provider.ts      # (Stub) Git CLI wrapper
│   └── cross-cutting/
│       ├── middleware.ts        # Logging, auth, audit, rate-limiting
│       └── permissions.ts       # (Stub) RBAC checks
├── ARCHITECTURE.md              # Design patterns & extension points
├── VENDOR_REFERENCE.md          # Official VS Code API docs (stored)
├── package.json                 # Minimal, strict dependencies
├── tsconfig.json                # TypeScript strict mode
└── README.md                    # This file
```

---

## Quick Start

### Install Dependencies
```bash
npm install
```

### Compile TypeScript
```bash
npm run compile
```

### Run in Extension Development Host
1. Open in VS Code: `code .`
2. Press `F5` to launch Extension Development Host
3. In the dev window, run command palette: `Git: Show Status`

### Watch Mode (for development)
```bash
npm run watch
```

---

## Architecture Overview

### Layers

1. **Application Layer** (`main.ts`, `router.ts`)
   - Extension activation/deactivation
   - Domain registration
   - Command dispatch

2. **Domain Layer** (`domains/`)
   - Isolated business logic (git, hygiene, chat)
   - Command handlers
   - Domain services

3. **Infrastructure Layer** (`infrastructure/`)
   - Logger, Config, GitProvider, WorkspaceProvider
   - Typed wrappers for external systems

4. **Cross-Cutting** (`cross-cutting/`)
   - Middleware (logging, auth, audit, rate-limiting)
   - Permissions and access control

### Core Patterns

#### Command Registration (Validated at Startup)
```typescript
const router = new CommandRouter(logger);
const gitDomain = createGitDomain(gitProvider, logger);
router.registerDomain(gitDomain);
await router.validateDomains(); // All handlers initialized
```

#### Command Dispatch (with Middleware Chain)
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

#### Error Handling (Result Monad)
```typescript
async function statusHandler(ctx, params) {
  const result = await gitProvider.status(params.branch);
  if (result.kind === "ok") {
    return success(result.value);
  }
  return result; // Forward error
}
```

#### Middleware (Declaratively Applied)
```typescript
router.use(createLoggingMiddleware(logger));
router.use(createAuditMiddleware(logger));
// Executed in order before handler dispatch
```
---

## Features

### Git & Repository Analytics
- **Git status & flows**: View branch health (clean/dirty, staged/unstaged/untracked), pull from remote, and create validated commits, including an interactive **smart commit** flow that groups changes and suggests messages.
- **Inbound change analysis**: Analyze inbound remote changes before pulling to understand conflict risk and impacted files.
- **Analytics dashboards & exports**: Generate Git analytics (churn, volatility, authorship, trends) and view them in a full-screen dashboard with charts, tables, and JSON/CSV export.

### Workspace Hygiene
- **Hygiene scans**: Scan the workspace for dead files, large/log/markdown files, and dead TypeScript code while respecting `.gitignore` and `.meridianignore`.
- **Safe cleanup**: Perform targeted cleanup of candidates (with optional dry-run) and manage them from a dedicated Hygiene view (delete or ignore).
- **Hygiene analytics**: Open a hygiene analytics dashboard showing prune candidates, disk impact, and file-type breakdowns over time.
- **AI doc review**: Request LLM-powered reviews of markdown files surfaced by hygiene scans.

### Workflows & Agents
- **JSON-defined workflows**: Discover and run workflows from `.vscode/workflows/*.json` (and bundled assets), including conditional branches and shared variables between steps.
- **Automation agents**: Discover agents from `.vscode/agents/*.json` that wrap capabilities (git, hygiene, workflows) into reusable automation profiles.
- **VS Code views**: Browse and run workflows and inspect agents from dedicated sidebar views.

### Chat / Copilot Integration
- **`@meridian` chat participant**: Use Meridian from Copilot Chat with slash and keyword commands (`/status`, `/scan`, `/workflows`, `/agents`, `/analytics`, `/context`, `run <workflow>`).
- **LLM intent routing**: Let an LLM classify free-form chat requests into concrete commands (`git.*`, `hygiene.*`, `workflow.*`, `agent.*`, `chat.*`).
- **Tooling for autonomy**: Expose Git, hygiene, workflow, and analytics commands as LM tools so copilots can orchestrate them programmatically.

### Configuration & Observability
- **Typed configuration**: Configure Git auto-fetch, hygiene enablement/thresholds, log level, and model selection via strongly-typed settings.
- **Middleware & telemetry**: All commands run through logging/audit/rate-limit middleware and are observable via a central command bus.

### Git Domain
- **git.status** — Read-only; returns branch, dirty state, staged/unstaged counts
- **git.pull** — Mutation; pulls from branch with error handling
- **git.commit** — Mutation with validation; requires message param

### Hygiene Domain
- **hygiene.scan** — Analyzes workspace for dead files, large logs
- **hygiene.cleanup** — Removes files with optional dry-run mode

### Chat/Copilot Domain
- **chat.context** — Gathers active file + git state for copilot context window
- **chat.delegate** — Spawns subagent for complex work

---

## Design Principles

1. **No Magic** — All strings are typed constants, explicit configuration
2. **Result Monad** — Errors surfaced explicitly, no exceptions in normal flow
3. **Dependency Injection** — Services receive dependencies, fully testable
4. **Middleware Chain** — Cross-cutting concerns applied declaratively
5. **Handler Registration** — Commands validated at startup, not at call time
6. **Tool Export** — Domains expose tools for external orchestration
7. **Subagent Delegation** — Background tasks spawn agents, capture results
8. **Clear Boundaries** — Each domain owns its schema, no type leaks

---

## Type Safety

**TypeScript Strict Mode**
```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "noUnusedLocals": true,
  "noImplicitReturns": true
}
```

All handler signatures explicitly typed:
```typescript
export type Handler<P = unknown, R = unknown> = (
  ctx: CommandContext,
  params: P
) => Promise<Result<R>>;
```

Command names discriminated union:
```typescript
export type CommandName =
  | "git.status" | "git.pull" | "git.commit"
  | "hygiene.scan" | "hygiene.cleanup"
  | "chat.context" | "chat.delegate";
```

---

## Configuration

Typed schema in `infrastructure/config.ts`:

```typescript
export const CONFIG_KEYS = {
  GIT_AUTOFETCH: "git.autofetch",
  HYGIENE_ENABLED: "hygiene.enabled",
  CHAT_MODEL: "chat.model",
  LOG_LEVEL: "log.level",
} as const;

const config = new Config();
const autofetch = config.get(CONFIG_KEYS.GIT_AUTOFETCH, false);
```

Declared in `package.json`:
```json
{
  "configuration": {
    "properties": {
      "meridian.git.autofetch": { "type": "boolean", "default": false }
    }
  }
}
```

---

## Middleware Stack

Middleware executed in registration order:

1. **LoggingMiddleware** — Tracks command execution time, logs start/end
2. **AuditMiddleware** — Logs mutations (git, cleanup, delegation)
3. (Custom: PermissionMiddleware, RateLimitMiddleware)
4. **Handler** — Business logic

Middleware can throw to fail fast (auth denied, rate limit exceeded).

---

## Extending the Architecture

### Add a New Domain
1. Create `src/domains/<name>/{handlers.ts,service.ts}`
2. Add commands to `CommandName` union in `types.ts`
3. Register in `main.ts`: `router.registerDomain(newDomain)`

### Add Middleware
1. Create factory in `cross-cutting/middleware.ts`
2. Register in `main.ts`: `router.use(createMyMiddleware(...))`

### Add Configuration
1. Add key to `CONFIG_KEYS` in `config.ts`
2. Add default and schema entry
3. Declare in `package.json` contribution points

### Expose External Tool
1. Register in domain service: `this.tools.set("my-tool", {...})`
2. Implement handler that calls domain handler
3. Export via `exportTools()` method

---

## Testing

### Unit Tests (Handlers)
```typescript
const mockGit = { status: jest.fn().mockResolvedValue(...) };
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

---

## Dependencies

**Runtime**: None (except `@vscode/api` when integrated with VS Code)

**Development**:
- `typescript@^5.2.0`
- `@types/node@^20.0.0`
- `@types/vscode@^1.80.0`

---

## Known Limitations

- Mock providers used (git, workspace) — replace with real VS Code API wrappers
- `sessions_spawn()` stubbed — reserved for future orchestration integration
- No background task scheduling — needed for hygiene scans
- No pre-commit hooks — git domain extension point
- No full test suite — scaffold only, not production-ready tests

---

## References

- **ARCHITECTURE.md** — Design patterns, extension points, examples
- **VENDOR_REFERENCE.md** — Official VS Code API docs (curated)
- **VS Code Extension API**: https://code.visualstudio.com/api
- **Commands Guide**: https://code.visualstudio.com/api/extension-guides/command
- **Contribution Points**: https://code.visualstudio.com/api/references/contribution-points

---

## License

MIT

---

**Version**: 0.0.1-rc1  
**Last Updated**: Feb 2026
