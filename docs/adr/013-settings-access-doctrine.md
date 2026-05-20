# ADR 013 — Settings Access Doctrine

**Date:** 2026-05-20
**Status:** Accepted

## Context

After the 2.0 product re-anchor (ADR 012), the settings layer carried drift the
old `Config` class had been built around but never enforced:

- `Config.get()`/`set()` were never called by any consumer; only
  `getPruneConfig()` was live. The class loaded 7 keys into an in-memory store
  that nothing read.
- `CONFIG_KEYS` declared `chat.model` and `chat.contextLines` that did not exist
  in `package.json`; their defaults could never activate.
- `package.json contributes.configuration.properties` declared 5 settings
  (`meridian.git.autofetch`, `git.branchClean`, `hygiene.enabled`,
  `hygiene.scanInterval`, `log.level`) that no code consumed — UI surface
  advertising inert controls.
- The 9 settings that *were* live were read by direct
  `vscode.workspace.getConfiguration()` calls scattered across 4 modules with
  inconsistent shapes; `operation-policy.ts` carried a defensive shim to
  tolerate incomplete `vscode` mocks in tests.

The drift was invisible at the type layer because the typed `ConfigProvider`
interface modeled a different set of keys than the manifest actually
contributed, and neither side validated against the other.

## Decision

A single chokepoint for every `meridian.*` settings read, backed by a typed
registry and CI-enforced parity with the manifest.

1. **Registry.** `src/infrastructure/settings.ts` exports `SETTING_DEFAULTS`,
   an `as const` object literal mapping every contributed setting key to its
   typed default. `as const` narrows enum-valued defaults at the type level;
   `SettingKey` / `SettingValue<K>` are derived.

2. **Accessor.** A single `readSetting<K>(key: K): SettingValue<K>` reads
   `vscode.workspace.getConfiguration("meridian").get(key, default)`. Its
   try/catch is the *only* place that absorbs malformed `vscode` (test mocks,
   host returning a bad proxy) — per-callsite defensive shims are forbidden.

3. **Domain-shaped readers stay in the domain.** `getPruneConfig()` lives in
   `src/domains/hygiene/prune-config.ts`, not in `infrastructure/`. The
   registry is generic; only hygiene knows the `PruneConfig` shape.

4. **Runtime enum narrowing at the policy boundary.** `as const` narrows the
   type, but VS Code does not enforce enum membership on user-supplied values.
   Policy getters that gate behavior on a discriminated union
   (e.g. `getGitNetworkMode`) narrow at runtime and fall back to the safest
   value (`prompt`). Type narrowing alone is insufficient at the trust boundary.

5. **Parity is a test, not a startup check.** `tests/manifest.test.ts` asserts
   `Object.keys(SETTING_DEFAULTS).sort() === contributedPropertyNames.sort()`.
   Either side drifts → CI fails. A startup check is rejected as either silent
   (logged warning users ignore) or fail-closed on a packaging bug already
   caught by CI.

6. **No DI through `CommandContext`.** Unlike `GitProvider` and
   `WorkspaceProvider`, which are stateful adapters that benefit from
   injection, settings are stateless reads against a global VS Code API. The
   module-level `vi.mock("vscode")` covers tests; threading a settings
   provider through `CommandContext` would be ceremony with no testing payoff.

## Alternatives considered

**Typed `Config` class with `initialize()` cache + DI through `CommandContext`.**
Rejected — the original shape. Cached values that consumers never read; no
parity enforcement against the manifest; gave a false sense of type safety
because the typed schema and the contributed schema were independently
maintained and silently diverged.

**Thin `readMeridianSetting(section, key, default)` pass-through.** Rejected —
no central registry, no parity table, defaults remain at call sites. Cheaper
diff but doesn't solve the drift root cause.

**Wire `readSetting()` into VS Code's `onDidChangeConfiguration` for live
push.** Rejected for now — current consumers read at command-entry or scan
time, not in tight loops. `getConfiguration()` is itself cheap and VS Code
caches internally. Revisit only if a consumer ends up in a hot path.

## Consequences

- **Positive.** One module to audit when settings questions arise. CI-enforced
  parity catches future drift from either direction. The `getSecurityConfig`
  shim and 4 scattered call patterns collapse to one shape. Adding a new
  setting is a 2-line patch: registry entry + `package.json` property.
- **Cost.** Each `readSetting` call re-resolves `getConfiguration("meridian")`
  (vs the dead `Config` class's startup cache). Measured to not matter at
  current call frequencies. If it ever does, batch at the caller (`const cfg
  = vscode.workspace.getConfiguration("meridian"); cfg.get(...)`) rather than
  reintroducing a module-level cache.
- **Layering invariant.** `src/infrastructure/settings.ts` must not import
  from `src/domains/*`. Domain-specific shapes (like `PruneConfig`) live in
  their domain and consume `readSetting` rather than the other direction.
- **Updated by [ADR 014](./014-dotdir-doctrine.md):** a sparse
  `.meridian/settings.json` workspace-file overlay was layered on top of this
  chokepoint. Workspace-file keys override VS Code config; absent keys fall
  through. Runtime narrowing at the policy boundary (Rule 4) absorbs the new
  untyped JSON trust boundary.

## Adoption checklist for new settings

1. Add the key to `SETTING_DEFAULTS` in `src/infrastructure/settings.ts` with
   its typed default.
2. Add the matching `meridian.<key>` entry to
   `package.json contributes.configuration.properties`.
3. Read via `readSetting("<key>")` at the consuming call site.
4. If the value gates behavior on a discriminated union, narrow at runtime
   (see `getGitNetworkMode` in `src/security/operation-policy.ts`).
5. `npx vitest run tests/manifest.test.ts` — the parity assertion must pass.
