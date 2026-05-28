# ADR 016 — Host-portable UI affordances doctrine

**Date:** 2026-05-28
**Status:** Accepted

## Context

Meridian targets multiple VS Code-compatible hosts. Download share data shows
Cursor is the dominant host; VS Code is secondary. Two recent incidents made
the asymmetry concrete:

1. **Settings cog (ADR 013 implementation).** VS Code synthesizes a per-view
   settings cog that resolves to `@ext:<id>` filtered settings via the view's
   contributing extension. Cursor renders the cog but does not implement that
   resolution — it falls through to unfiltered Settings. The host API behaves
   identically on the surface and diverges silently behind it. Fixed by
   contributing an explicit `meridian.openSettings` command
   ([e6d1126](https://github.com/scscodes/meridian/commit/e6d1126),
   [0f483ff](https://github.com/scscodes/meridian/commit/0f483ff)).

2. **Loading-state coverage audit (this ADR's companion work).** Identified
   `ProgressLocation { viewId }` and `ProgressLocation.Window` as similar
   surfaces — VS Code APIs whose Cursor parity is unmeasured. Betting on them
   risks the same silent-divergence failure mode.

The pattern: relying on host-rendered chrome to drive Meridian UX means
Meridian's behavior is gated on the host's interpretation of the spec, which
can vary without an obvious signal. Bugs surface as user reports weeks later.

## Scope

This ADR layers a **host-portability lens** over the rendering surface choices
made in [ADR 006](./006-rendering-surface-decision-matrix.md). It does not
replace 006's matrix — webview/tree/output/toast remain the four canonical
surfaces, and the output-shape-to-surface mapping in 006 is unchanged. The
rules below apply when an affordance has a *choice* about how to render busy
state, progress, or competing user actions; they do not override 006's surface
selection.

## Decision

For any new Meridian UI affordance, in priority order:

1. **Distinct glyphs over duplicate gear.** Where the host already contributes
   a competing affordance (e.g. synthesized settings cog), Meridian's own
   contribution uses a visually distinct glyph (e.g. `$(kebab-vertical)`, not
   `$(settings-gear)`). No host detection. No conditional contribution. The
   distinction is doing the work, not the absence.

2. **Render busy/loading state inside the active surface, not in host chrome.**
   When the rendering surface chosen by ADR 006 needs to indicate "work in
   flight," prefer affordances on the surface itself (tree placeholder rows,
   webview DOM overlays) over host-chrome progress APIs scoped to that surface
   (`ProgressLocation { viewId }`, `ProgressLocation.Window`). This rule is
   specifically about *busy-state* rendering on tree/webview surfaces — it
   does not displace 006's use of toast for short scalars (those are
   results, not in-flight indicators) nor the output channel for long-form
   prose. Examples shipped:
   - Tree busy state: `ThemeIcon("loading~spin")` placeholder rows in
     `GitTreeProvider` and `HygieneTreeProvider`. Codicon glyph, no host API.
   - Webview overlay: `.meridian-loading` CSS class toggled by webview JS in
     response to host-posted `{type:"loading"}` messages. DOM we own.

3. **Restrict host progress APIs to surfaces with verified parity.**
   `ProgressLocation.Notification` (toast) is retained — it underpins
   existing `PROGRESS_COMMANDS` ([command-registry.ts:21-29](../../src/presentation/command-registry.ts#L21-L29)),
   has verified parity across hosts, and is the right shape for
   command-palette-triggered work (user explicitly invoked, toast is the
   acknowledgement). The following are deferred until Cursor parity is
   measured:
   - `vscode.window.withProgress({ location: { viewId } })` — per-view header
     spinner. Native to VS Code; Cursor behavior unverified.
   - `vscode.window.withProgress({ location: ProgressLocation.Window })` —
     status-bar progress. Likely works on Cursor; renders in a slot we don't
     own.

   If a future measurement confirms parity, this list narrows and Rule 2's
   "prefer own surface" can relax for the now-verified API.

4. **No host-conditional UI gating.** `vscode.env.appName` detection is
   permitted for telemetry, logging, ADR research, or genuine host workarounds
   — but not for asymmetric UI rendering. Two hosts converging on the same
   affordance via different code paths is a maintenance trap; one affordance
   that works on both is the goal.

## Alternatives considered

**Host-conditional contributions via `appName`.** Considered as a way to
suppress Meridian's gear on VS Code (where the native cog works) and ship it
on Cursor. Rejected: once Meridian's glyph differs from the host's (kebab vs
gear), the two affordances don't compete visually, so conditional suppression
solves a problem that no longer exists. Adds complexity without benefit.

**`ProgressLocation { viewId }` for tree-header spinners.** The native VS Code
API for exactly the problem we're solving. Rejected pending Cursor
measurement. Revisit if/when verified — would simplify tree busy state by
removing the placeholder-row mechanism.

**Shared webview loading module instead of per-UI duplication.** Three
webview UIs each gained ~15 lines CSS + 4 lines JS for the overlay. A shared
module would require wiring `localResourceRoots` and adjusting
`BaseWebviewProvider.buildHtml`. Rejected: duplication cost is small,
sharing cost is larger, and a future parity test
(`webviewLoadingParity.test.ts`) can catch drift if it ever becomes real.

## Consequences

- **Positive.** Meridian UX is host-portable by construction. Future hosts
  (VSCodium, code-server, web variants) inherit the behavior without
  per-host validation. Cursor-primary download share is served with the same
  fidelity as VS Code.
- **Cost.** Marginally more Meridian-side code than relying on the host. The
  webview overlay is duplicated three times; the tree busy state adds ~25
  lines per provider. Acceptable given the alternative (silent divergence
  bugs).
- **Constraint on future work.** Any new affordance that wants to live on
  host chrome (view header, status bar, activity bar) must first verify
  rendering on Cursor before adopting the corresponding host API. Default
  remains "render in surfaces we own."
- **Cross-references:**
  - [ADR 006](./006-rendering-surface-decision-matrix.md) — surface choice
    remains 006's responsibility; this ADR governs *how* the chosen surface
    indicates busy/loading state and handles host-chrome competition. ADR 006
    Rule 5 (in-panel refresh/filter errors land as panel banners, not modal
    toasts) extends naturally: in-panel refresh/filter *progress* now lands
    as a panel overlay, per Rule 2 above.
  - [ADR 013](./013-settings-access-doctrine.md) — settings access (read
    side) is unaffected. This ADR governs the UI affordance that *invokes*
    settings access (the Meridian Actions kebab).
