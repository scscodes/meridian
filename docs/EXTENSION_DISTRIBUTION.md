# Extension Distribution

Meridian (`scscodes.meridian`) is published to both the Visual Studio Marketplace and Open VSX.

## Release path

- Trigger: push to `main`
- Workflow: `.github/workflows/publish.yml`
- Release tooling: `semantic-release` (packages `.vsix` and publishes when credentials are available)

## Required secrets

- `VSCE_PAT`: Visual Studio Marketplace publish token
- `OVSX_PAT`: Open VSX publish token (optional; if unset, Open VSX publish is skipped)

## Canonical references

- ADR: `docs/adr/017-extension-publishing.md`
- Workflow: `.github/workflows/publish.yml`
