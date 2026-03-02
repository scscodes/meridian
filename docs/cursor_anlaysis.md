## Meridian – Cursor Critical/Hygiene Analysis (Mar 2, 2026)

This document captures a code- and doc-level hygiene review of the Meridian VS Code extension.  
Scope: identify **concrete, line-cited** issues (anti-patterns, dead/waste code, drift, or logical anomalies), and propose **actionable remediation steps with expected effects**. No assumptions are made beyond what is explicitly present in the repo.

---

## Summary of Key Findings

- **F1 – Config surface drift & unused settings**: `Config` is initialized but never read; several contributed `meridian.*` settings are never used; config keys in code do not match contributed keys.
- **F2 – Parallel/unused config and error registries**: `EnhancedConfig`, duplicate `ERROR_CODES`, and duplicate `CommandName`/telemetry types create multiple, diverging sources of truth.
- **F3 – Docs vs behavior: configuration & environment**: Architecture/docs claim VS Code-backed config and env var support that do not exist in the active code path.
- **F4 – Example workflows and docs reference non-existent commands/files**: e.g. `hygiene.lint`, `hygiene.test`, `refactor/error-handling.md`, `TESTING.md`.
- **F5 – Chat delegation and UX mismatch**: `chat.delegate` is implemented but unreachable from chat; chat UX differs materially from roadmap/docs.
- **F6 – Analytics path filter and week bucketing limitations**: `pathPattern` filter is a stub and week bucketing is non-ISO; these are partially documented but still affect correctness.
- **F7 – Error handling & logging inconsistencies**: Silent directory-scan failures and direct `console.*` logging bypass structured logging patterns.
- **F8 – Over-provisioned constants & config knobs**: Several constants and settings are unused, increasing drift risk.

The sections below provide per-finding evidence, impact, and remediation plans.

---

## F1 – Config Surface Drift & Unused Settings

### Evidence

- `Config` defines a schema and defaults, but only ever seeds an in-memory store and is not consulted elsewhere:

```11:44:src/infrastructure/config.ts
export const CONFIG_KEYS = {
  GIT_AUTOFETCH: "git.autofetch" as const,
  GIT_BRANCH_CLEAN: "git.branchClean" as const,
  HYGIENE_ENABLED: "hygiene.enabled" as const,
  HYGIENE_SCAN_INTERVAL: "hygiene.scanInterval" as const,
  CHAT_MODEL: "chat.model" as const,
  CHAT_CONTEXT_LINES: "chat.contextLines" as const,
  LOG_LEVEL: "log.level" as const,
} as const;

const DEFAULTS: ConfigSchema = {
  [CONFIG_KEYS.GIT_AUTOFETCH]: false,
  [CONFIG_KEYS.GIT_BRANCH_CLEAN]: true,
  [CONFIG_KEYS.HYGIENE_ENABLED]: true,
  [CONFIG_KEYS.HYGIENE_SCAN_INTERVAL]: 60,
  [CONFIG_KEYS.CHAT_MODEL]: "gpt-4",
  [CONFIG_KEYS.CHAT_CONTEXT_LINES]: 50,
  [CONFIG_KEYS.LOG_LEVEL]: "info",
};
```

```54:59:src/infrastructure/config.ts
async initialize(): Promise<Result<void>> {
  try {
    // In extension context, load from vscode.workspace.getConfiguration()
    // For now, just use defaults
    this.store = { ...DEFAULTS };
    return success(void 0);
  } catch (err) {
    ...
  }
}
```

- `Config` is constructed and initialized in `activate`, but its values are never read:

```131:135:src/main.ts
// Initialize infrastructure layer
const logger = new Logger();
const config = new Config();
await config.initialize();
```

- VS Code contributed settings use `meridian.*` prefixes, but there is no usage of these keys in the TypeScript code:

```216:292:package.json
"configuration": {
  "title": "Meridian",
  "properties": {
    "meridian.git.autofetch": { "type": "boolean", "default": false, ... },
    "meridian.hygiene.enabled": { "type": "boolean", "default": true, ... },
    "meridian.hygiene.scanInterval": { "type": "number", "default": 60, ... },
    "meridian.log.level": { "type": "string", "enum": ["debug","info","warn","error"], ... },
    ...
  }
}
```

`grep` for `meridian.git.autofetch`, `meridian.hygiene.enabled`, `meridian.hygiene.scanInterval`, and `meridian.log.level` shows occurrences only in `package.json` (and the README snippet), not in `src/**/*.ts`.

### Impact

- VS Code exposes settings that **do not affect runtime behavior**. Users can change these knobs in Settings with zero effect, which is misleading.
- The `Config` abstraction suggests a single source of truth backed by VS Code config, but in reality it is an in-memory default map that no consumer reads.
- The key spaces diverge: `Config` uses `"git.autofetch"`, while VS Code contributes `"meridian.git.autofetch"`, so wiring them together later is non-trivial.

### Remediation Plan

- **R1.1 – Decide on config strategy and remove dead surfaces**
  - Either make `Config` the canonical abstraction backed by `vscode.workspace.getConfiguration("meridian")`, or remove it in favor of direct `vscode.workspace.getConfiguration` usage (as already done in `readPruneConfig` and `model-selector.ts`).
  - **Effect**: Reduces confusion about where configuration lives and ensures there is a single pattern for accessing settings.

- **R1.2 – Align key namespaces**
  - If `Config` remains, update it to use the same `meridian.*`-prefixed keys as `package.json`, and actually read from those keys.
  - **Effect**: Users changing `meridian.git.autofetch` et al. see behavior changes consistent with settings UI.

- **R1.3 – Remove or wire unused settings**
  - Either:
    - Wire `meridian.git.autofetch`, `meridian.hygiene.enabled`, `meridian.hygiene.scanInterval`, and `meridian.log.level` into the appropriate domains/middleware, **or**
    - Remove these contributions from `package.json` (and associated docs) until they are implemented.
  - **Effect**: Eliminates settings-surface drift and prevents “no-op” configuration from accumulating.

---

## F2 – Parallel / Unused Config & Error Registries

### Evidence

- `EnhancedConfig` is a fully implemented alternative configuration provider that is never imported:

```29:56:src/infrastructure/enhanced-config.ts
export const CONFIG_KEYS = {
  GIT_AUTOFETCH: "git.autofetch" as const,
  GIT_BRANCH_CLEAN: "git.branchClean" as const,
  GIT_DEFAULT_REMOTE: "git.defaultRemote" as const,
  GIT_DEFAULT_BRANCH: "git.defaultBranch" as const,
  ...
  TELEMETRY_ENABLED: "telemetry.enabled" as const,
  TELEMETRY_VERBOSE: "telemetry.verbose" as const,
} as const;
...
export class EnhancedConfig implements ConfigProvider {
  private store: Partial<ConfigSchema> = {};
  async initialize(): Promise<Result<void>> { ... this.store = { ...DEFAULTS }; }
  get<T>(key: string, defaultValue?: T): T | undefined { ... }
  async set<T>(key: string, value: T): Promise<Result<void>> { ... }
  ensure<T>(key: string, defaultValue?: T): T { ... }
}
```

`grep` for `EnhancedConfig` returns only this file, confirming it is unused.

- There are **two distinct error-code registries**:

```50:86:src/constants.ts
export const ERROR_CODES = {
  CONFIG_INIT_ERROR: "CONFIG_INIT_ERROR",
  CONFIG_SET_ERROR: "CONFIG_SET_ERROR",
  ...
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;
...
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
```

```10:41:src/infrastructure/error-codes.ts
export const GIT_ERROR_CODES = {
  GIT_UNAVAILABLE: "GIT_UNAVAILABLE",
  GIT_STATUS_ERROR: "GIT_STATUS_ERROR",
  ...
  NO_GROUPS_APPROVED: "NO_GROUPS_APPROVED",
} as const;
...
export const ERROR_CODES = {
  ...GIT_ERROR_CODES,
  ...HYGIENE_ERROR_CODES,
  ...CHAT_ERROR_CODES,
  ...WORKFLOW_ERROR_CODES,
  ...ROUTER_ERROR_CODES,
  ...INFRASTRUCTURE_ERROR_CODES,
  ...GENERIC_ERROR_CODES,
} as const;
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
```

- Telemetry imports `ErrorCode` and `CommandName` from `constants.ts`, not the more detailed `error-codes.ts` or `types.ts`:

```11:16:src/infrastructure/telemetry.ts
import { Logger, AppError } from "../types";
import {
  TELEMETRY_EVENT_KINDS,
  CommandName,
  ErrorCode,
} from "../constants";
```

- `CommandName` is also defined in two places:

```45:64:src/types.ts
export type CommandName =
  | GitCommandName
  | HygieneCommandName
  | ChatCommandName
  | WorkflowCommandName
  | AgentCommandName;
...
export type HygieneCommandName = "hygiene.scan" | "hygiene.cleanup" | "hygiene.showAnalytics";
export type ChatCommandName = "chat.context" | "chat.delegate";
export type WorkflowCommandName = "workflow.list" | "workflow.run";
export type AgentCommandName = "agent.list";
```

```12:24:src/constants.ts
export const COMMAND_NAMES = {
  GIT: { STATUS: "git.status", PULL: "git.pull", COMMIT: "git.commit", ... },
  HYGIENE: { SCAN: "hygiene.scan", CLEANUP: "hygiene.cleanup", SHOW_ANALYTICS: "hygiene.showAnalytics" },
  CHAT: { CONTEXT: "chat.context", DELEGATE: "chat.delegate" },
  WORKFLOW: { LIST: "workflow.list", RUN: "workflow.run" },
  AGENT: { LIST: "agent.list" },
} as const;
...
export type CommandName =
  typeof COMMAND_NAMES[keyof typeof COMMAND_NAMES][keyof typeof COMMAND_NAMES[keyof typeof COMMAND_NAMES]];
```

### Impact

- Future contributors do not know which `ErrorCode` or `CommandName` type to import; adding a new command or error in one registry can silently diverge from the other.
- `EnhancedConfig` appears production-ready but is entirely unused, hiding the fact that configuration is still “defaults-only”.
- Documentation (see F3) refers to `error-codes.ts` as the central definition, while telemetry and some code instead lean on `constants.ts`.

### Remediation Plan

- **R2.1 – Choose a single canonical config provider**
  - Either adopt `EnhancedConfig` as the real implementation (and delete/inline the simpler `Config`), or delete `EnhancedConfig` and keep only `Config`.
  - **Effect**: Removes dead code and clarifies where new config behavior should be implemented.

- **R2.2 – Consolidate error-code definitions**
  - Make `src/infrastructure/error-codes.ts` the **only** module exporting `ERROR_CODES` and `ErrorCode`, and have `constants.ts` import from there (or vice versa).
  - Update telemetry to import `ErrorCode` from the canonical module.
  - **Effect**: Guarantees all error codes are defined in one place, avoiding partial or inconsistent updates.

- **R2.3 – Consolidate `CommandName`**
  - Pick a single `CommandName` definition (likely `types.ts`), and re-export it from `constants.ts` rather than redefining it.
  - **Effect**: Prevents subtle divergence between type-level and constant-level command registries.

---

## F3 – Docs vs Behavior: Configuration & Environment

### Evidence

- Architecture docs claim that `config.ts` integrates workspace settings:

```119:123:docs/ARCHITECTURE.md
**config.ts** — Configuration Provider
- Typed schema (no string keys)
- Defaults + VS Code workspace settings
- Example: `CONFIG_KEYS.GIT_AUTOFETCH`, `CONFIG_KEYS.HYGIENE_ENABLED`
```

But `config.ts` currently only copies `DEFAULTS` into an in-memory `store` (see F1), with comments explicitly noting “for now, just use defaults”.

- The same doc and section “Configuration & Constants” state that config defaults and environment variables live in `error-codes.ts`:

```452:466:docs/ARCHITECTURE.md
### Configuration Defaults

Centralized in `src/infrastructure/error-codes.ts`:

export const TIMEOUTS = {
  GIT_OPERATION: 30_000,
  GIT_CLONE: 120_000,
  WORKFLOW_STEP: 60_000,
  NETWORK_REQUEST: 10_000,
} as const;
...
```

```474:483:docs/ARCHITECTURE.md
### Environment Variables

Supported environment variables:
| Variable | Default | Purpose |
| `GIT_PATH` | `"git"` | Path to git executable |
| `TELEMETRY_ENABLED` | `"true"` | Enable telemetry events |
| `TELEMETRY_ENDPOINT` | None | Telemetry endpoint URL |
| `LOG_LEVEL` | `"info"` | Logging level |
```

`grep` for `GIT_PATH`, `TELEMETRY_ENDPOINT`, and `TELEMETRY_ENABLED` shows no usage in `src/**/*.ts` beyond `enhanced-config.ts` defaults; there is **no `process.env.*` read** and no runtime wiring to environment variables.

### Impact

- Contributors reading `docs/ARCHITECTURE.md` can reasonably assume VS Code settings and environment variables influence runtime behavior; they currently do not.
- This misalignment can cause wasted debugging cycles (“why does changing LOG_LEVEL have no effect?”) and incorrect assumptions when extending the config surface.

### Remediation Plan

- **R3.1 – Soften or correct documentation**
  - Update `docs/ARCHITECTURE.md` and `README.md` to match current behavior (defaults-only, no env var integration) until the wiring exists.
  - **Effect**: Aligns expectations for readers; no one will assume non-existent configuration features.

- **R3.2 – Or implement the described behavior**
  - As an alternative, implement:
    - `vscode.workspace.getConfiguration("meridian")`-backed config reads for the documented keys.
    - Environment variable hooks for `GIT_PATH`, `TELEMETRY_ENABLED`, `TELEMETRY_ENDPOINT`, `LOG_LEVEL` where appropriate (git provider, telemetry sink, logger).
  - **Effect**: Brings the runtime in line with documentation, making the “Configuration & Constants” section accurate.

---

## F4 – Example Workflows and Docs Reference Non-Existent Commands/Files

### Evidence

- `example-workflow.json` references `hygiene.lint`, which is not a command in `HygieneCommandName` or implemented in handlers:

```1:12:example-workflow.json
{
  "name": "lint-and-commit",
  ...
  "steps": [
    {
      "id": "lint",
      "command": "hygiene.lint",
      "params": { "path": "." },
      "onSuccess": "validate",
      "onFailure": "exit"
    },
    ...
  ]
}
```

```61:64:src/types.ts
export type HygieneCommandName = "hygiene.scan" | "hygiene.cleanup" | "hygiene.showAnalytics";
```

`grep` for `"hygiene.lint"` finds only `example-workflow.json` and documentation; there is no handler or command registration for it.

- `docs/ARCHITECTURE.md` uses the same non-existent commands in workflow examples:

```579:599:docs/ARCHITECTURE.md
{
  "name": "lint-and-commit",
  ...
  "steps": [
    {
      "id": "lint",
      "command": "hygiene.lint",
      ...
    },
    {
      "id": "test",
      "command": "hygiene.test",
      ...
    },
    {
      "id": "commit",
      "command": "git.smartCommit",
      ...
    }
  ]
}
```

- The same doc references files that do not exist in the repo:

```341:343:docs/ARCHITECTURE.md
### Detailed Error Handling Guide

See **refactor/error-handling.md** for comprehensive before/after examples...
```

`glob` for `refactor/**` and `TESTING.md` returns no files in the workspace; these are stale references.

### Impact

- Readers copying the `lint-and-commit` workflow examples or `example-workflow.json` into `.vscode/workflows` will see validation failures or runtime errors because `hygiene.lint`/`hygiene.test` are not valid commands.
- Documentation suggests the existence of refactor guides and testing docs that do not exist, which can mislead contributors looking for canonical patterns.

### Remediation Plan

- **R4.1 – Update or remove invalid workflow examples**
  - Replace `hygiene.lint`/`hygiene.test` in examples with real commands (`hygiene.scan`, etc.), or clearly mark them as hypothetical and not implemented.
  - **Effect**: Prevents users from creating invalid workflows based on examples.

- **R4.2 – Align or remove references to non-existent docs**
  - Either add the referenced docs (`refactor/error-handling.md`, `TESTING.md`, etc.) with up-to-date content, or remove/soften references in `docs/ARCHITECTURE.md`.
  - **Effect**: Ensures all documentation references resolve to real files, improving discoverability and reducing frustration.

---

## F5 – Chat Delegation & UX Mismatch

### Evidence

- `chat.delegate` is implemented and registered in the chat domain:

```24:27:src/domains/chat/service.ts
export const CHAT_COMMANDS: ChatCommandName[] = [
  "chat.context",
  "chat.delegate",
];
```

```86:137:src/domains/chat/handlers.ts
export function createDelegateHandler(
  dispatcher: CommandDispatcher,
  logger: Logger
): Handler<DelegateParams, DelegateResult> {
  return async (ctx: CommandContext, params: DelegateParams) => {
    ...
    const command: Command<{ name: string; task: string }> = {
      name: "workflow.run",
      params: { name: workflow, task },
    };
    const result = await dispatcher(command, ctx);
    ...
    return success({
      dispatched: true,
      workflow,
      message: `Workflow "${workflow}" dispatched for task "${task}"`,
    });
  };
}
```

- The chat participant **never maps user input to `chat.delegate`**; it routes only to a fixed set of command names:

```17:25:src/ui/chat-participant.ts
const SLASH_MAP: Record<string, CommandName> = {
  "/status":    "git.status",
  "/scan":      "hygiene.scan",
  "/workflows": "workflow.list",
  "/agents":    "agent.list",
  "/analytics": "git.showAnalytics",
  "/context":   "chat.context",
};
```

```212:222:src/ui/chat-participant.ts
const VALID_COMMANDS: Record<string, CommandName> = {
  "git.status":         "git.status",
  "git.smartCommit":    "git.smartCommit",
  "git.pull":           "git.pull",
  "git.analyzeInbound": "git.analyzeInbound",
  "git.showAnalytics":  "git.showAnalytics",
  "hygiene.scan":       "hygiene.scan",
  "workflow.list":      "workflow.list",
  "agent.list":         "agent.list",
  "chat.context":       "chat.context",
};
```

There is **no mapping** to `chat.delegate`, and the classifier fallback defaults unknown intents to `chat.context`.

- `docs/DEBUG_AUDIT_AGENTS_WORKFLOWS_CHAT.md` already documents that `chat.delegate` is unreachable from chat and that most input falls back to context; this is acknowledged debt, not hidden behavior.

### Impact

- Chat delegation capabilities exist in the backend but are effectively **dead code from the chat UX** perspective.
- Roadmap/docs suggest that chat can “delegate tasks to workflows,” but only direct `workflow.run` dispatch is supported; delegation via `chat.delegate` cannot be triggered by users.

### Remediation Plan

- **R5.1 – Decide on `chat.delegate` role**
  - Either:
    - Wire `chat.delegate` into the chat participant (e.g. a “run &lt;workflow&gt; for &lt;task&gt;” pattern), or
    - Remove `chat.delegate` from the domain and docs until a clear UX is designed.
  - **Effect**: Eliminates the mismatch between advertised delegation and what the user can actually invoke.

- **R5.2 – Make chat UX explicit in docs**
  - Document the current chat behavior more plainly (slash commands + `run <name>` + classifier-to-command mapping) and note that free-form “delegate” behavior is not yet supported.
  - **Effect**: Aligns user expectations with the actual surface while leaving room to introduce richer delegation later.

---

## F6 – Analytics Path Filter & Week Bucketing Limitations

These items are already partially documented in `docs/TODO.md`, but they still represent **live correctness issues**.

### Evidence

- `pathPattern` filter in analytics options is a stub:

```232:239:src/domains/git/analytics-service.ts
/**
 * Check if commit matches path pattern filter
 */
private matchesPathPattern(_commit: CommitMetric, _pattern: string): boolean {
  // For now, simple path filtering
  // In a full implementation, would parse numstat and check file paths
  return true; // TODO: implement path filtering
}
```

`docs/TODO.md` explicitly calls this out and explains that `pathPattern` has no effect.

- Week bucketing uses week-of-month instead of a true calendar/ISO week:

```447:451:src/domains/git/analytics-service.ts
private getWeekKey(date: Date): string {
  const d = new Date(date);
  const week = Math.ceil(d.getDate() / 7);
  return `${d.getFullYear()}-W${week.toString().padStart(2, "0")}`;
}
```

`docs/TODO.md` and comments in `constants.ts` (`ANALYTICS_SETTINGS.TREND_NORMALIZE_WEEKS`) describe this as a known limitation.

### Impact

- UI and export surfaces that allow “filter by path” will **mislead users**: they see a filtered view but the underlying report still includes all paths.
- Trend and frequency charts can be numerically and bucket-wise misleading, especially across longer periods or month boundaries.

### Remediation Plan

- **R6.1 – Implement real path filtering**
  - Inspect `commit.files` and use `micromatch.isMatch(file.path, pattern)` to decide whether a commit should be included when `opts.pathPattern` is set.
  - **Effect**: Makes the path filter behave as users expect and aligns with `docs/TODO.md` remediation notes.

- **R6.2 – Implement proper week bucketing**
  - Replace the week-of-month approach with a proper ISO week calculation (e.g., as sketched in `docs/TODO.md`) and adjust labels accordingly.
  - **Effect**: Produces stable, comparable week buckets across months and periods; trends become interpretable.

- **R6.3 – Re-validate docs after fixes**
  - Once implemented, remove or update the corresponding TODO entries to avoid lingering “known issue” notes that are no longer valid.

---

## F7 – Error Handling & Logging Inconsistencies

### Evidence

- `WorkspaceProvider.collectFiles` silently skips unreadable directories without logging:

```37:43:src/infrastructure/workspace-provider.ts
async function collectFiles(
  dir: string,
  pattern: string
): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return; // directory unreadable — skip silently
    }
    ...
  }
}
```

- Telemetry tracker swallows sink errors and logs directly to `console.error`:

```415:421:src/infrastructure/telemetry.ts
private emit(event: TelemetryEvent): void {
  try {
    this.sink.emit(event);
  } catch (err) {
    // Silently fail; don't let telemetry errors break the application
    console.error("Telemetry emit failed", err);
  }
}
```

- `ConsoleTelemetrySink` also logs via `console.log`:

```555:569:src/infrastructure/telemetry.ts
export class ConsoleTelemetrySink implements TelemetrySink {
  ...
  emit(event: TelemetryEvent): void {
    if (this.silent) {
      return;
    }
    const importantKinds = [
      TELEMETRY_EVENT_KINDS.COMMAND_STARTED,
      TELEMETRY_EVENT_KINDS.COMMAND_FAILED,
      TELEMETRY_EVENT_KINDS.ERROR_OCCURRED,
      TELEMETRY_EVENT_KINDS.WORKFLOW_FAILED,
    ];
    if (importantKinds.includes(event.kind as any)) {
      console.log(`[TELEMETRY:${event.kind}]`, event.payload);
    }
  }
}
```

- The logger is explicitly documented as “No console.log, explicit levels”:

```1:3:src/infrastructure/logger.ts
/**
 * Structured Logger — No console.log, explicit levels.
 */
```

### Impact

- If telemetry or workspace traversal fails, **users receive no surfaced error and no structured log entry**; diagnosing missing files or telemetry sink failures becomes difficult.
- Direct `console.*` logging bypasses the structured logger and any future log sinks (files, telemetry), contrary to the design principle advertised in `logger.ts` and docs.

### Remediation Plan

- **R7.1 – Log traversal failures via `Logger` or hygiene analytics**
  - Enhance `WorkspaceProvider` to log a warning when a directory cannot be read (optionally throttled or summarized), instead of silently skipping.
  - **Effect**: When scans miss parts of the workspace, maintainers can see why and where in logs.

- **R7.2 – Route telemetry failures through the logger**
  - Replace `console.error`/`console.log` in telemetry with either:
    - A dedicated logger, or
    - A no-op in production builds (if telemetry is best-effort only).
  - **Effect**: Keeps all diagnostic output flowing through the same structured logging pipeline and adheres to the “no console.log” principle.

---

## F8 – Over-Provisioned Constants & Config Knobs

### Evidence

- `CACHE_SETTINGS` and other constant groups define multiple values that are unused by current code:

```107:134:src/constants.ts
export const CACHE_SETTINGS = {
  MAX_LOG_ENTRIES: 1000,
  LOG_TTL_MS: 30 * 60 * 1000,
  MAX_WORKFLOW_CACHE: 100,
  WORKFLOW_CACHE_TTL_MS: 60 * 60 * 1000,
  MAX_AGENT_CACHE: 50,
  AGENT_CACHE_TTL_MS: 60 * 60 * 1000,
  GIT_STATUS_TTL_MS: 5 * 60 * 1000,
  ANALYTICS_TTL_MS: 10 * 60 * 1000,
  DEAD_CODE_TTL_MS: 5 * 60 * 1000,
} as const;
```

`grep` shows only `ANALYTICS_TTL_MS` and `DEAD_CODE_TTL_MS` are used (in git analytics and dead-code analyzer); the other entries have no consumers.

- Additional constant groups such as `AGENT_SETTINGS` and `PERFORMANCE_BOUNDS` are similarly unused:

```454:463:src/constants.ts
export const AGENT_SETTINGS = {
  MAX_CAPABILITIES_PER_AGENT: 20,
  ALLOW_DYNAMIC_REGISTRATION: true,
  DISCOVERY_TIMEOUT_MS: 5 * 1000,
} as const;
```

`grep` for `AGENT_SETTINGS` and `PERFORMANCE_BOUNDS` finds no usage outside `constants.ts`.

### Impact

- These constants appear to be tunable knobs, but changing them has **no effect**; this is another form of configuration drift (internal rather than user-facing).
- The presence of unused constants makes it harder to see which parts of the system are actually configurable and increases cognitive load when reasoning about performance or caching.

### Remediation Plan

- **R8.1 – Trim unused constant entries or mark them as future work**
  - Remove unused constants, or move them into a clearly labeled “future/experimental” section (or a TODO doc) until they are wired.
  - **Effect**: Makes the active configuration surface clearer and reduces the risk of someone “tuning” values that have no effect.

- **R8.2 – Where appropriate, wire constants into implementations**
  - For any constants that represent genuine design intent (e.g., workflow cache TTLs), implement the corresponding caching or behavior.
  - **Effect**: Aligns the code’s behavior with the declared configuration constants, improving predictability.

---

## Closing Notes

- Some issues (notably analytics path filtering and week bucketing, and chat/agent discovery behavior) are already partially documented in `docs/TODO.md` and `docs/DEBUG_AUDIT_AGENTS_WORKFLOWS_CHAT.md`. They remain listed here because they have live user-facing impact.
- The highest-risk drift items are **F1–F4** (config/settings and docs vs reality). Addressing those first will most improve predictability for users and contributors.***
