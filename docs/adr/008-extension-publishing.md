# ADR 008 — Extension publishing (VS Marketplace and Open VSX)

**Date**: 2026-04-24  
**Status**: Accepted

---

## Context

The extension ID is `scscodes.meridian` (`publisher` + `name` in `package.json`).

- **Visual Studio Marketplace** is where official VS Code loads extensions from the Microsoft store.
- **Open VSX** is the public registry used by [Cursor](https://cursor.com/help/customization/extensions.md) and other VS Code–compatible products. Listing there is what makes the same `.vsix` installable in those clients and keeps “import from VS Code” flows from failing on a missing ID.

Microsoft and Eclipse use **separate** accounts, tokens, and CLIs. There is no single combined publish; we run one automated pipeline that can push to both when credentials are present.

---

## Decision

1. **Automation** — Pushes to `main` that produce a [semantic-release](https://github.com/semantic-release/semantic-release) release run `semantic-release` with [semantic-release-vsce](https://github.com/felipecrs/semantic-release-vsce) (see `.releaserc.json`). The plugin packages a `.vsix` and, when tokens are set, publishes to each registry. GitHub release assets and changelog commits follow the same config.

2. **CI** — [`.github/workflows/publish.yml`](../../.github/workflows/publish.yml) sets:
   - `VSCE_PAT` — Azure DevOps PAT with **Marketplace → Manage** (see [Microsoft: publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)).
   - `OVSX_PAT` — access token from [open-vsx.org](https://open-vsx.org/) (see [Open VSX: publishing](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)).
   - If `OVSX_PAT` is missing, the plugin still publishes to the Marketplace when `VSCE_PAT` is set; Open VSX is skipped.

3. **One-time Open VSX setup** (per maintainer, before the first Open VSX publish):
   - Eclipse account + **Publisher Agreement** on Open VSX
   - Generate a token; create the **namespace** matching `publisher` (e.g. `npx ovsx create-namespace scscodes -p "<token>"`)

4. **Manual / debug** — `npx ovsx publish` / `npx @vscode/vsce package` for local testing; not part of the normal path once CI is green.

---

## Consequences

- **Secrets live in GitHub** (`Settings → Secrets and variables → Actions`); not in the repo.
- **Open VSX support** makes Meridian available to Cursor, VSCodium, Gitpod, Theia, and other VS Code-compatible editor distributions.
- **Same version** and `.vsix` are used for both marketplaces on a given release, avoiding drift between stores.
- Optional **Cursor “verified” publisher** steps remain policy on Cursor’s side (website + Open VSX `homepage` + forum); not encoded here.
- Deeper registries/CLI material stays in the official links above; this ADR is the project’s “where and how we ship.”
