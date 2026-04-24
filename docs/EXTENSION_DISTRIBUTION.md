# Extension distribution: VS Code Marketplace and Open VSX

Meridian is published as `scscodes.meridian` (`publisher` + `name` in `package.json`).

- **Visual Studio (VS Code) Marketplace** — primary store for official VS Code.
- **Open VSX Registry** — used by [Cursor](https://cursor.com/help/customization/extensions.md) and other VS Code–compatible editors; publishing here is what makes the extension resolvable when users import from VS Code or install inside Cursor.

Releases on `main` are automated with [semantic-release](https://github.com/semantic-release/semantic-release) and [semantic-release-vsce](https://github.com/felipecrs/semantic-release-vsce) (see `.releaserc.json`).

## Official references

| Topic | Link |
|--------|------|
| VS Code: packaging and publishing with `vsce` | <https://code.visualstudio.com/api/working-with-extensions/publishing-extension> |
| Open VSX: account, agreement, token, `ovsx` CLI | <https://github.com/eclipse/openvsx/wiki/Publishing-Extensions> |
| `semantic-release-vsce` (env vars, both marketplaces) | <https://github.com/felipecrs/semantic-release-vsce#environment-variables> |
| Cursor: extensions and Open VSX | <https://cursor.com/help/customization/extensions.md> |
| Cursor: migration / VS Code import | <https://cursor.com/docs/configuration/migrations/vscode.md> |
| `ovsx` npm package (CLI used under the hood) | <https://www.npmjs.com/package/ovsx> |

## One-time: Open VSX (maintainer)

Do this before the first Open VSX publish (registry names must exist before upload — see the wiki **Create the namespace** step):

1. [Eclipse account](https://accounts.eclipse.org/user/register) (GitHub username must match what you use on open-vsx.org, per the wiki).
2. Sign in at [open-vsx.org](https://open-vsx.org/) and link Eclipse; on your profile, **Sign the Publisher Agreement** (wiki §2).
3. Create an [access token](https://open-vsx.org/user-settings/tokens) (wiki §3).
4. Create the **namespace** matching `publisher` in `package.json` (`scscodes`):
   ```bash
   npx ovsx create-namespace scscodes -p "<paste-token>"
   ```
5. [Claim the namespace / verified publisher](https://github.com/eclipse/openvsx/wiki/Namespace-Access) if you want a verified badge (optional).

## GitHub Actions secrets

| Secret | Used for |
|--------|-----------|
| `VSCE_PAT` | Azure DevOps personal access token with **Marketplace: Manage** — see [Microsoft’s PAT steps](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token). |
| `OVSX_PAT` | Open VSX access token (same value as in step 3 above). If unset, `semantic-release-vsce` skips Open VSX and only publishes to the VS Marketplace (when `VSCE_PAT` is set). |

**Repository:** GitHub → **Settings** → **Secrets and variables** → **Actions** → add `OVSX_PAT` alongside `VSCE_PAT`.

## How CI wires this

[`.github/workflows/publish.yml`](../.github/workflows/publish.yml) sets `OVSX_PAT` in the `semantic-release` step. The plugin:

- Publishes to the **Visual Studio Marketplace** when `VSCE_PAT` is set.
- Publishes to **Open VSX** when `OVSX_PAT` is set (uses the `.vsix` from the `prepare` step; see [plugin publishing behavior](https://github.com/felipecrs/semantic-release-vsce#publishing)).

## Optional: Cursor “verified” publisher

Cursor’s [Extensions](https://cursor.com/help/customization/extensions.md) help describes requesting a verification badge (website link, Open VSX `homepage`, matching extension ID, forum post). This is separate from Open VSX namespace claims.

## Manual publish (debug)

If you need to push a local `.vsix` without a release:

```bash
npx ovsx publish path/to/meridian-*.vsix -p "<token>"
```

Or from the repo root after `vsce package` / `npm run` prepublish:

```bash
npx ovsx publish -p "<token>"
```

See the [Open VSX wiki](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions#5-package-and-upload) for full options.
