# Topic 08 — Startup-Wide Activation Footprint

## Risk Statement

Extension activates for all sessions on startup completion.

## Evidence

- `package.json`
  - L30-L31: `"activationEvents": ["onStartupFinished"]`.

## Scope

- Applies across all workspaces where extension is enabled.
- Increases review attention on "what runs in background."

## Likelihood / Impact

- Likelihood: High.
- Impact: Low-Medium (mainly policy/behavior optics unless combined with risky startup tasks).

## Viable Mitigations

1) Narrow activation events where feasible.
- Prefer command-driven activation for optional features.

2) Document startup behavior.
- Explicitly state what does and does not run automatically.

## Implementation Status (2026-04-23)

- `src/main.ts`
  - Added startup-gated registration switches:
    - `meridian.startup.enableFileWatchers`
    - `meridian.startup.enableChatSurface`
  - When disabled, watcher/chat/tool surfaces are not registered at activation time.
- `package.json`
  - Added user-facing startup configuration keys:
    - `meridian.startup.enableFileWatchers` (default `true`)
    - `meridian.startup.enableChatSurface` (default `true`)

Current assessment: **Partially mitigated**. Activation event remains `onStartupFinished`, but startup runtime surface is now configurable and can be reduced for stricter environments.
