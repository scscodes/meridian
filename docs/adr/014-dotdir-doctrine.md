# ADR 014 — Dotdir Doctrine

**Date:** 2026-05-20
**Status:** Accepted

## Context

Meridian shipped with a single `.meridianignore` dotfile at the workspace root,
materialized lazily by the **Ignore File / Folder** context-menu action. The
ceiling on that pattern was visible: the only growth path was "append another
dotfile per concern" (`.meridianlock`, `.meridianconfig`, etc.), which is the
exact pattern the wider ecosystem moved away from. Per-tool dotdirs are now
the convention — `.cursor/` (Cursor), `.claude/` (Claude Code), `.github/`
(GitHub), `.vscode/` (VS Code), `.husky/` (husky), `.idea/` (JetBrains).

The settings layer was just remediated in ADR 013: 14 keys with parity-enforced
`SETTING_DEFAULTS`, a single `readSetting<K>()` chokepoint, and runtime narrowing
at policy boundaries. That work is the foundation this builds on — the
chokepoint can absorb a workspace-file precedence layer with no consumer churn.

The objective: lock in the dotdir before shipping more features that would have
to be retrofit. Hard cut on the legacy dotfile (auto-migrate on activation),
introduce a sparse workspace-level settings overlay, and scaffold the
convention for future generated artifacts. `.vscode/meridian/run-log.v1.jsonl`
stays put — it is a host-runtime concern, not workspace configuration.

## Decision

1. **`.meridian/` is the per-workspace home for Meridian configuration.** Its
   first inhabitants are `.meridian/.meridianignore` and
   `.meridian/settings.json`. Future per-workspace state (artifacts, generated
   reports, caches) lives under this root, materialized lazily by writers via
   `fs.mkdirSync(..., { recursive: true })`. We do not pre-create empty dirs.

2. **Ignore filename is `.meridian/.meridianignore`** — a wholesale relocation
   of the existing dotfile. Zero re-education: same filename users already
   know, same gitignore syntax, same workspace searches still find it. The
   leading dot inside the dotdir matches the universal `.<tool>ignore`
   aesthetic (`.gitignore`, `.dockerignore`, `.cursorignore`,
   `.claudeignore`). Precedent for leading-dot files inside dotdirs:
   `.husky/_/.gitignore`, `.idea/.gitignore`. Editor syntax highlighting is
   contributed via `package.json` `contributes.languages` mapping
   `**/.meridian/.meridianignore` to the built-in VS Code `ignore` language.
   - Rejected `.meridian/.gitignore` (git would consume it as a literal
     gitignore for `.meridian/` contents).
   - Rejected `.meridian/ignore` (bare name has no recognized-config-file
     aesthetic; flagged as abnormal in review).
   - Rejected namespaced names like `.meridian/.scan.ignore` (premature; we
     have one ignore file today, scaling to multiple is a future ADR).

3. **`.meridian/settings.json` overrides VS Code `meridian.*` settings —
   sparse, file-first.** Only keys present in the workspace file override the
   VS Code-resolved value; absent keys fall through. Mtime-cached at the
   single chokepoint (`readSetting<K>()`). Missing file, malformed JSON, and
   non-object payloads all collapse to "no overrides" — never throw, never
   block activation.

4. **Untyped JSON deserialization is acceptable for workspace settings.** The
   `as SettingValue<K>` cast is the trust boundary; security-sensitive keys
   are narrowed at the consumption point per ADR 013 Rule 4
   (`getGitNetworkMode`, `getAllowedGitHosts`, `isSensitiveLoggingEnabled`).
   Non-policy keys match VS Code's own trust model — settings files are
   committed to the repo, and repo trust applies. Per-key runtime validators
   in `SETTING_DEFAULTS` are deferred until a non-policy key actually needs
   one.

5. **Hard cut on the legacy `.meridianignore`.** On activation, if a legacy
   file exists at the workspace root and `.meridian/.meridianignore` does not,
   `migrateLegacyIgnoreFile()` `fs.renameSync`s it into place. One-shot,
   idempotent, non-fatal on failure (warns and leaves the legacy file
   in-place). No dual-read code path. Meridian is pre-1.0 / pre-marketplace —
   no deprecation window owed.

6. **`.vscode/meridian/` is host-runtime, not workspace-config.** The
   `run-log.v1.jsonl` artifact tracks per-host activation traces and stays
   under `.vscode/`. Moving it into `.meridian/` would force gitignore
   complexity (runtime logs would need exclusion) and conflates two different
   lifecycles. `.meridian/` is shared workspace state; `.vscode/meridian/` is
   host-scoped runtime output.

7. **`.meridian/artifacts/` is convention only.** Documented as the future
   home for generated reports / cached scan results. Not materialized until a
   writer needs it. No preemptive `mkdir`.

## Alternatives considered

**Continue with per-concern dotfiles at the workspace root.** Rejected — the
exact pattern the ecosystem abandoned. Every new feature would add a new
top-level file; user-facing root-clutter compounds; no shared structure for
generated artifacts.

**YAML for `.meridian/settings.json`.** Rejected. JSON is the universal config
format in the VS Code / TypeScript ecosystem (`tsconfig.json`,
`package.json`, `settings.json` itself); no value added by YAML; adds a parser
dependency.

**Dual-read deprecation window.** Rejected per decision 5 — pre-1.0; no installed base owed a window.

**File-watcher subscription on `.meridian/settings.json` for live reload.**
Deferred. VS Code's `getConfiguration()` is re-resolved on each call with no
push notification either; matching that semantics is sufficient until a
consumer needs hot-swap.

## Consequences

- **Positive.** A single, scalable home for workspace-level Meridian state.
  Future features (artifacts, generated reports, caches, locks) drop in under
  `.meridian/` without new top-level files. Workspace-file settings give teams
  a committed, reviewable override layer that VS Code's per-user settings
  cannot. The dotdir aesthetic matches user expectations from every other
  per-tool surface they already use.
- **Cost.** One activation-time migration call. One module
  (`infrastructure/dotdir-migration.ts`) to maintain — small, isolated,
  test-covered. `readSetting<K>()` carries a small `fs.statSync` per call when
  a workspace root is resolvable; mtime-cached, no IO when the cache is warm.
- **Layering invariant.** `src/infrastructure/dotdir-migration.ts` and the
  workspace-settings layer in `src/infrastructure/settings.ts` do not depend
  on `src/domains/*`. Domain consumers continue to call `readSetting<K>()` /
  `readMeridianIgnorePatterns()` / `appendIgnorePattern()` unchanged — the
  abstraction surface is unchanged; only the on-disk paths moved.
- **Multi-root caveat.** Like `gitProvider`, `workspaceProvider`, `runLog`,
  and the existing settings reader, the migration and workspace-settings
  resolver use `workspaceFolders[0]`. Matches the existing single-root
  assumption baked across the extension; no new gap introduced.

## Addendum (2026-05-21) — `.meridian/artifacts/` realized

Decision 7 promised `.meridian/artifacts/` as convention-only until a writer
needed it. The webview report exporters are that first writer. Concretions:

- **First writer is the webview export path.** `BaseWebviewProvider` gained a
  **quick-save** (dialog-free, one click → timestamped file under
  `.meridian/artifacts/`) and a **Save as…** escape hatch (format pick → save
  dialog, defaulted to the same dir). Both reuse the existing pure serializers
  (`gitReportToCsv`, `reportToJson`). All three report webviews inherit the
  behavior. This is human-facing UX only — no agent/command surface (a dead
  command-export path was removed in the same line of work).
- **Self-ignoring dir, not a root-`.gitignore` edit.** On lazy creation the
  writer drops `.meridian/artifacts/.gitignore` containing `*` (idempotent —
  never clobbers a user edit). Generated reports therefore never enter git and
  produce zero `git status` noise. A root-`.gitignore` rule was rejected:
  Meridian owns `.meridian/` (layering invariant) but not the consumer's root
  `.gitignore`, and the self-contained form is the only one that works in
  arbitrary installed workspaces.
- **Full-timestamp filenames.** `<prefix>-<YYYY-MM-DDTHH-MM-SS-mmm>.<fmt>`, with
  `:`/`.` replaced (NTFS-invalid) and milliseconds retained. Replaces the prior
  date-only stamp; removes silent-overwrite (two saves in the same second no
  longer collide) and makes each export individually addressable.
- **No path-guard on the write target.** `resolveWorkspacePath` realpaths its
  argument and would throw on a not-yet-existent file. The artifacts dir is
  `mkdir`-ed (so it exists) and the basename is fully self-generated (constant
  prefix + generated timestamp, no external input) — no traversal vector to
  guard against.

## Cross-references

- [ADR 013](./013-settings-access-doctrine.md) — settings chokepoint and
  runtime narrowing at the policy boundary. Unchanged by this ADR; extended
  by a workspace-file overlay at the same chokepoint.
- `src/infrastructure/settings.ts` — `readSetting<K>()` + workspace overlay.
- `src/infrastructure/dotdir-migration.ts` — one-shot activation migration.
- `src/security/ignore-store.ts` — `IGNORE_FILE` const points at
  `.meridian/.meridianignore`; consumers unchanged.
- `package.json` `contributes.languages` — `ignore` syntax highlighting for
  `.meridian/.meridianignore`.
