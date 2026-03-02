## Meridian Configuration Architecture – Canonical Layer vs Domain-Level API

This document compares two closely related configuration strategies for Meridian, using concrete evidence from the current codebase and end-to-end implementation plans. No code changes have been made; this is a design artefact only.

- **Strategy A**: Single canonical configuration layer/service (canonical config).
- **Strategy B**: Clear domain-level configuration API (per-domain config façades).

Both are compatible and can be composed; the goal here is to understand their respective responsibilities, how they wire through the existing DDD layers, and how easy they are to enforce once adopted.

---

## 1. Strategy A – Single Canonical Configuration Layer

### 1.1 Current touchpoints and drift

- **Local config providers (unused by domains)**
  - `src/infrastructure/config.ts` defines `Config implements ConfigProvider` with internal keys like `"git.autofetch"`, `"hygiene.enabled"`, but:
    - It only seeds an in-memory `store` from `DEFAULTS`.
    - It is constructed in `main.ts` (`L131–135`) and never passed to domains or infra.
  - `src/infrastructure/enhanced-config.ts` defines `EnhancedConfig` with a richer schema (`CONFIG_KEYS`, `DEFAULTS`, `VALIDATION_RULES`) and defaults wired to `GIT_DEFAULTS`, `CHAT_SETTINGS`, `LOG_SETTINGS`, but:
    - It is **never imported or instantiated** outside that file.

- **Direct VS Code configuration reads**
  - `src/main.ts:L41-50` (`readPruneConfig`) uses `vscode.workspace.getConfiguration("meridian.hygiene.prune")` to read:
    - `minAgeDays`, `maxSizeMB`, `minLineCount`, `categories`.
  - `src/infrastructure/model-selector.ts:L15-21` reads `vscode.workspace.getConfiguration("meridian.model")`:
    - `meridian.model.hygiene`, `.git`, `.chat`, `.default`.

- **Internal defaults acting as config**
  - `src/constants.ts:L140-170` – `GIT_DEFAULTS`.
  - `src/constants.ts:L176-219` – `HYGIENE_SETTINGS` (used by `hygiene` handlers and dead-code analyzer).
  - `src/constants.ts:L269-287` – `CHAT_SETTINGS`.
  - `src/constants.ts:L293-308` – `LOG_SETTINGS`.
  - `src/constants.ts:L466-497` – `ANALYTICS_SETTINGS`.

- **Contributed VS Code settings (some unused)**
  - `package.json:L216-292` contributes:
    - `meridian.git.autofetch`, `meridian.hygiene.enabled`, `meridian.hygiene.scanInterval`, `meridian.log.level`, `meridian.model.*`, `meridian.hygiene.prune.*`.
  - Only `meridian.model.*` and `meridian.hygiene.prune.*` are read today; others are declared but dormant.

### 1.2 Canonical config service responsibilities

A canonical config service (e.g. `MeridianConfig`) would:

- **Be the only consumer of `vscode.workspace.getConfiguration` and `process.env`**:
  - Centralize access to `meridian.*` settings and env overrides (e.g. `GIT_PATH`, `LOG_LEVEL`, `TELEMETRY_ENABLED`, `TELEMETRY_ENDPOINT`).
- **Unify defaults and validation**:
  - Use `GIT_DEFAULTS`, `HYGIENE_SETTINGS`, `CHAT_SETTINGS`, `LOG_SETTINGS`, `PRUNE_DEFAULTS` as internal default sources.
  - Reuse validation semantics already present in `EnhancedConfig.VALIDATION_RULES`.
- **Expose a typed key-space**:
  - Internal keys like `"git.autofetch"`, `"hygiene.enabled"`, `"model.default"`, `"log.level"`, `"telemetry.enabled"`, `"hygiene.prune.minAgeDays"`, etc.
  - Map each internal key to:
    - Zero or one VS Code setting (`meridian.*`).
    - Zero or one env var.
    - One default constant.
- **Provide basic and higher-level accessors**:
  - Generic `get<T>(key, default?)` / `ensure<T>(key)` per `ConfigProvider`.
  - Higher-level helpers like:
    - `getPruneConfig(): PruneConfig` (wraps `readPruneConfig` semantics).
    - `getModelFamily(domain?: "git" | "hygiene" | "chat"): string`.
    - `getLogLevel(): "debug" | "info" | "warn" | "error"`.

### 1.3 End-to-end action items for Strategy A

Without changing code yet, the planned migration path is:

1. **Promote `EnhancedConfig` to the canonical implementation**
   - Merge its schema, defaults, and validation into `src/infrastructure/config.ts`, making it the concrete `Config` used by `main.ts`.
   - Wire VS Code settings and env vars into its initialization logic:
     - `vscode.workspace.getConfiguration("meridian")` for `meridian.git.*`, `meridian.hygiene.*`, `meridian.log.*`, etc.
     - `vscode.workspace.getConfiguration("meridian.model")` for `meridian.model.*`.
     - `process.env` for `GIT_PATH`, `LOG_LEVEL`, `TELEMETRY_ENABLED`, `TELEMETRY_ENDPOINT`.

2. **Wrap existing direct configuration reads**
   - Replace `readPruneConfig()`’s direct VS Code usage with a helper that calls `Config.getPruneConfig()`.
   - Change `model-selector.ts` to accept a `getModelFamily(domain)` function (or `Config` instance) instead of calling `workspace.getConfiguration` directly.

3. **Start using canonical config in infra & domains**
   - Inject the canonical `Config` into:
     - `GitProvider` for git path/timeouts/default remote/branch.
     - `HygieneDomainService` for enablement and scan interval.
     - `Logger` for log level and buffer size.
     - `TelemetryTracker` for `enabled` / `verbose` / endpoint.
   - Keep defaults identical to current behavior; only turn on behavior for contributed settings currently ignored (`meridian.git.autofetch`, `meridian.hygiene.enabled`, `meridian.hygiene.scanInterval`, `meridian.log.level`) once tested.

4. **Enforce “config flows through this service”**
   - After migration, `grep` for:
     - `workspace.getConfiguration(` – should exist only in `config.ts` (and possibly one small wrapper for models).
     - `process.env` – should exist only in `config.ts`.
   - Use code review/linters to block new direct usages.

### 1.4 Compatibility and enforcement

- **DDD fit**: mirrors existing `GitProvider`/`WorkspaceProvider` pattern; `ConfigProvider` is already defined in `types.ts`. Domains continue to treat configuration as an injected infrastructure dependency.
- **Enforcement**: easy to check mechanically (search for `workspace.getConfiguration`, `process.env`) and conceptually (any new config code must touch only `config.ts` and constants).
- **Risk**: low, if initial wiring preserves current defaults and only enables currently-dormant settings after validation.

---

## 2. Strategy B – Clear Domain-Level Configuration API

### 2.1 Current per-domain config-related behavior

The domains currently rely on a mix of:

- **Constants from `src/constants.ts`**
  - Git: `GIT_DEFAULTS` (L140–170), `ANALYTICS_SETTINGS` (L466–497).
  - Hygiene: `HYGIENE_SETTINGS` (L176–219), `HYGIENE_ANALYTICS_EXCLUDE_PATTERNS` (L229–263), `CACHE_SETTINGS` entries.
  - Workflow: `WORKFLOW_SETTINGS` (L436–448), `PERFORMANCE_BOUNDS` (L388–412), `CACHE_SETTINGS.WORKFLOW_*`.
  - Agent: `AGENT_SETTINGS` (L454–463), `CACHE_SETTINGS.AGENT_*`.
  - Logging/telemetry: `LOG_SETTINGS`, `TELEMETRY_EVENT_KINDS`.

- **Direct VS Code config reads in composition root**
  - `main.ts` `readPruneConfig()` – `meridian.hygiene.prune.*`.
  - `model-selector.ts` – `meridian.model.*`.

- **Enhanced-config schema (unused) that mirrors per-domain needs**
  - `EnhancedConfig.CONFIG_KEYS` defines per-domain keys for git, hygiene, chat, logging, telemetry (L29–54).
  - `DEFAULTS` and `VALIDATION_RULES` enforce domain-specific invariants (L106–130,L136–211).

### 2.2 Proposed domain-level configuration interfaces

On top of a canonical config layer, Strategy B introduces **per-domain façades** that hide key strings and wiring details from domain code. Examples (not implemented yet):

- **Git**

```ts
export interface GitDomainConfig {
  gitAutoFetchEnabled(): boolean;
  gitBranchCleanEnabled(): boolean;
  gitDefaultRemote(): string;
  gitDefaultBranch(): string;
  gitFallbackBranch(): string;
  gitOperationTimeoutMs(): number;
  gitMaxInboundChanges(): number;
  gitAnalyticsCacheTtlMs(): number;
}
```

- **Hygiene**

```ts
export interface HygieneDomainConfig {
  hygieneEnabled(): boolean;
  hygieneScanIntervalMs(): number;
  hygieneExcludePatterns(): string[];
  hygieneMaxFileSizeBytes(): number;
  hygieneTempFilePatterns(): string[];
  hygieneLogFilePatterns(): string[];
  hygieneDeadCodeCacheTtlMs(): number;
  hygieneAnalyticsCacheTtlMs(): number;
  hygienePruneConfig(): PruneConfig;
}
```

- **Chat, Workflow, Agent, Logging, Models**

```ts
export interface ChatDomainConfig { /* chatModelFamily(), chatResponseTimeoutMs(), etc. */ }
export interface WorkflowDomainConfig { /* workflowExecutionTimeoutMs(), workflowMaxSteps(), etc. */ }
export interface AgentDomainConfig { /* agentMaxCapabilitiesPerAgent(), agentCacheTtlMs(), etc. */ }
export interface LoggingConfig { /* logLevel(), logIncludeContext(), logMaxEntries() */ }
export interface ModelConfig { modelFamily(domain: "git" | "hygiene" | "chat"): string; }
```

A single `DomainConfigService` aggregates these:

```ts
export interface DomainConfigService {
  git: GitDomainConfig;
  hygiene: HygieneDomainConfig;
  chat: ChatDomainConfig;
  workflow: WorkflowDomainConfig;
  agent: AgentDomainConfig;
  logging: LoggingConfig;
  models: ModelConfig;
}
```

### 2.3 Wiring Strategy B on top of Strategy A

Assuming Strategy A provides a canonical config layer (`CanonicalConfigService` / `Config` that knows how to resolve `ConfigKey` → value):

1. **Implement per-domain adapters**
   - Example: `GitDomainConfigImpl` and `HygieneDomainConfigImpl` that each depend only on:
     - `CanonicalConfigService` for reading config values and defaults.
     - Domain-specific constants (`GIT_DEFAULTS`, `HYGIENE_SETTINGS`, `PRUNE_DEFAULTS`) for defaults.
   - These adapters map:
     - Internal key-space (e.g. `"git.autofetch"`, `"hygiene.enabled"`) to strongly typed methods.

2. **Compose `DomainConfigService` in `main.ts`**
   - After initializing the canonical `Config`:

```ts
const canonical = /* new Config or EnhancedConfig + initialize() */;
const domainConfig: DomainConfigService = {
  git: new GitDomainConfigImpl(canonical),
  hygiene: new HygieneDomainConfigImpl(canonical),
  chat: new ChatDomainConfigImpl(canonical),
  workflow: new WorkflowDomainConfigImpl(canonical),
  agent: new AgentDomainConfigImpl(canonical),
  logging: new LoggingConfigImpl(canonical),
  models: new ModelConfigImpl(vscode.workspace.getConfiguration("meridian.model")),
};
```

3. **Inject narrow domain config into each domain**
   - Update domain factories (conceptually) to accept only their slice:
     - `createGitDomain(gitProvider, logger, workspaceRoot, domainConfig.git)`.
     - `createHygieneDomain(workspaceProvider, logger, domainConfig.hygiene)`.
     - `createChatDomain(gitProvider, logger, dispatcher, domainConfig.chat)`.
     - `createWorkflowDomain(logger, stepRunner, workspaceRoot, extensionPath, domainConfig.workflow)`.
     - `createAgentDomain(logger, workspaceRoot, extensionPath, domainConfig.agent)`.
   - Infrastructure like `createGitProvider` or `selectModel` uses `domainConfig.git` / `domainConfig.models`.

4. **Change domain code to use intention-revealing methods**
   - Replace direct access to constants and raw settings with:
     - `config.gitAutoFetchEnabled()` instead of `GIT_DEFAULTS.AUTO_FETCH` in smart-commit / inbound-analysis workflows.
     - `config.hygienePruneConfig()` instead of `readPruneConfig()` for analytics.
     - `models.modelFamily("hygiene")` instead of custom config lookups inside `model-selector.ts`.

### 2.4 Compatibility and enforcement

- **DDD alignment**
  - Domains see configuration via small, explicit interfaces (`GitDomainConfig`, `HygieneDomainConfig`, etc.), mirroring how they see git/workspace providers and domain services today.
  - `src/domains/**` never touches:
    - `vscode.workspace.getConfiguration`.
    - Raw `meridian.*` strings.
    - `process.env`.
  - All config details stay in `infrastructure` and `constants`.

- **Discoverability**
  - Each domain’s tunables are grouped in one interface; contributors can search for `HygieneDomainConfig` to see what’s available.
  - IDE autocomplete for `config.hygiene.*` / `domainConfig.hygiene` lists all knobs.

- **Enforcing correct usage**
  - Simple mechanical rules:
    - No imports of `config.ts` or `vscode` in `src/domains/**`.
    - No direct usage of `HYGIENE_SETTINGS`, `GIT_DEFAULTS`, `LOG_SETTINGS`, `CHAT_SETTINGS` in domains; they must go through `*DomainConfig`.
  - Any new config field requires:
    - Updating the canonical config schema (Strategy A).
    - Extending the relevant `*DomainConfig` interface and implementation.
    - Optionally adding a VS Code setting in `package.json`.

---

## 3. Comparative View: Suitability & Ease of Enforcement

- **Strategy A – Canonical Config Layer**
  - **Primary focus**: one place to integrate VS Code settings, env vars, and internal defaults.
  - **Strengths**:
    - Strong single source of truth for configuration loading and validation.
    - Easy to audit and enforce via search for `workspace.getConfiguration` / `process.env`.
  - **Limitations**:
    - By itself, does not prevent domains from calling `Config.get("some.key")` with magic strings.

- **Strategy B – Domain-Level Config API**
  - **Primary focus**: giving each domain a narrow, intention-revealing view of configuration.
  - **Strengths**:
    - Enforces DDD boundaries: domains see only what they need, with names in the ubiquitous language.
    - High discoverability and testability; each domain’s config surface is explicit and mockable.
  - **Limitations**:
    - Requires the underlying canonical layer (Strategy A) for actual persistence and mapping to VS Code/env.

### 3.1 Combined recommendation (no code changes yet)

- The two strategies are **complementary, not competing**:
  - **Strategy A** is the plumbing: unify configuration retrieval and validation in one canonical service.
  - **Strategy B** is the façade: expose that configuration to each domain via small, typed interfaces that align with DDD boundaries.
- In practice:
  - Implement Strategy A first to eliminate drift between `Config`, `EnhancedConfig`, `package.json`, and direct `workspace.getConfiguration` calls.
  - Then layer Strategy B on top to keep domain code clean and prevent new magic-string config usage from creeping back in.

This document should be treated as the design reference when implementing either or both strategies; all concrete file references come from the current repo state.***

