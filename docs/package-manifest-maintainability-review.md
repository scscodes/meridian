# Package Manifest Maintainability Review

## Context

`package.json` in this project is serving as both:

- npm package metadata/scripts
- VS Code extension manifest (`contributes`, command/menu/keybinding/tool declarations)

Large file size is expected for feature-rich VS Code extensions. The core issue is not size alone; it is maintainability risk from duplication and drift.

## What Is Working

- Command IDs follow a coherent namespace (`meridian.<domain>.<action>`).
- Domain grouping is generally clear (`git`, `hygiene`, `workflow`, `agent`, `chat`).
- Rich extension capability is represented explicitly in manifest contributions.

## Maintainability Issues Identified

1. **High duplication across contribution surfaces**
   - The same command IDs are repeated across:
     - `contributes.commands`
     - `contributes.menus.*`
     - `contributes.keybindings`
   - Current snapshot: **91 total command references for 30 unique commands**.
   - Result: high change blast radius for rename/add/remove work.

2. **Drift risk between manifest and runtime registration**
   - Runtime command maps/registrations in `src/presentation/*` include commands not declared in `contributes.commands` (which may be intentional for internal flows, but increases ambiguity).
   - Without explicit policy and validation, discoverability/activation expectations can silently diverge.

3. **Script duplication**
   - `bundle` and `compile` scripts duplicate long post-build copy/sync chains.
   - This is fragile and harder to update safely.

4. **Weak guardrails**
   - `lint` is placeholder-only (`echo`), so there is no automated check for command registry consistency, manifest schema correctness, or duplication policy violations.

## Why This Matters

- **Refactor risk:** simple command changes require touching many places.
- **Onboarding cost:** contributors must understand implicit coupling across files.
- **Regression risk:** easy to forget one declaration surface (especially menus/keybindings/command palette visibility).
- **Delivery drag:** every feature addition pays repeated manifest bookkeeping overhead.

## Relevant Industry Norms

- VS Code extensions commonly have large manifests, but mature projects reduce drift via generation, validation, or strict conventions.
- npm best practices favor script composition and lifecycle hooks over giant inline shell pipelines.
- For large declarative configs, single-source metadata + generated artifacts is a common maintainability pattern.

References:

- [VS Code Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest)
- [VS Code Commands Guide](https://code.visualstudio.com/api/extension-guides/command)
- [npm scripts](https://docs.npmjs.com/cli/v10/using-npm/scripts)

## Strategy Options

### Option 1: Typed Single Source of Truth + Generated Manifest Sections

Define command/tool/view metadata once (TypeScript or structured config), then generate `contributes` sections and optionally runtime maps.

**Pros**

- Strongest anti-drift posture
- Lowest long-term maintenance cost
- Consistent IDs/titles/categories/visibility by construction
- Enables CI assertions from shared schema

**Cons**

- Requires build tooling investment
- Requires contributor familiarity with generation workflow

**Pitfalls**

- Non-deterministic generation can create noisy diffs
- Poor docs around generation can hurt contributor velocity

### Option 2: Split Manifest into Fragments + Merge Step

Break contribution-heavy sections into dedicated files (commands, menus, keybindings, tools, config), merge into final `package.json` during build/release.

**Pros**

- Lower adoption cost than full codegen
- Immediate readability gains
- Easier ownership boundaries by domain

**Cons**

- Still allows semantic duplication unless validated
- Requires merge tooling and ordering discipline

**Pitfalls**

- Fragment sprawl if naming/structure conventions are weak
- Teams may still manually duplicate IDs without policy checks

### Option 3: Surface-Area Reduction Only (Manifest Diet)

Keep current structure, reduce command exposure and palette/menu clutter, tighten `when` clauses, and consolidate user-facing entry points.

**Pros**

- Fastest short-term simplification
- Can improve UX discoverability quality if done carefully

**Cons**

- Does not remove root metadata duplication model
- Drift risk remains largely intact

**Pitfalls**

- Over-pruning can hide useful functionality
- Can create “implicit behavior” if discoverable command paths are reduced too aggressively

## Revisit and Consolidate

### Least Appropriate as a Standalone Path: Option 3

Option 3 treats symptoms (surface clutter) more than architecture (source duplication).

### Best-Of Absorption

Take Option 3’s strongest elements and fold them into Options 1 and 2:

- Classify commands as `public` vs `internal`
- Generate/enforce command palette visibility from that classification
- Require `when`/`enablement` policy checks for every public command
- Audit discoverability and avoid over-exposure in menus

## Final Ranked Recommendations

1. **Option 1 (Typed source + generation + validation)**  
   Most relevant for long-term maintainability and scale.
2. **Option 2 (Fragment + merge + validation)**  
   Best lower-risk transition path if team wants incremental change.

## Recommendation Pitch

### Pitch A (Preferred): Option 1

Invest once in a typed command/manifest metadata model and generate manifest sections. This addresses root causes (duplication + drift), improves confidence in refactors, and reduces recurring maintenance overhead.

### Pitch B (Transitional): Option 2

If immediate tooling investment is constrained, split and merge manifests first, but add strict validation from day one. This creates cleaner ownership and faster edits now, while preserving a migration path to full generation later.

## Key Risks to Watch Regardless of Path

- Unclear ownership of command metadata
- Weak CI enforcement
- Undocumented generation/merge workflow
- Internal commands accidentally exposed as public UX surface

## Suggested Next Discussion Topics

- Team appetite for up-front tooling investment vs incremental transition
- Ownership model for command metadata by domain
- CI gates required before rollout (schema, uniqueness, cross-surface consistency)
- Migration phases and rollback plan
