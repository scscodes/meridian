# Security

## Posture

Meridian is a local-first VS Code extension. It computes everything from the
workspace on disk and the local git history. There is no Meridian backend, no
account, and no analytics service.

### Network access

The extension itself opens no network connections. The only operations that can
reach the network are:

- **Git network operations** (`fetch` / `pull`) — gated by
  `meridian.security.gitNetwork.mode` (`allow` / `prompt` / `deny`, default
  `prompt`) and an optional remote-host allowlist
  (`meridian.security.gitNetwork.allowedHosts`). Both run through the single
  policy chokepoint in `src/security/operation-policy.ts`.
- **Optional language-model prose** — sent through the VS Code Language Model
  API (e.g. GitHub Copilot) only when a model is installed and enabled. Sends
  are gated by `meridian.security.lmEgress.mode` (default `prompt`) and every
  payload passes through `sanitizeLmPayload()` (token/secret redaction +
  truncation) in `src/security/lm-policy.ts`. All reports degrade to their
  deterministic content when no model is available or egress is denied.

Webviews enforce a `default-src 'none'` Content-Security-Policy with
nonce-only scripts and `connect-src 'none'`; chart.js is vendored at build
time, never loaded from a CDN.

### Telemetry

None leaves the machine. The telemetry tracker writes command lifecycle events
to an in-memory/console sink only (`src/infrastructure/telemetry.ts`). The
run-log is an append-only JSONL file inside the workspace.

### Filesystem boundaries

- Every read/delete and every webview-originated path is resolved through
  `resolveWorkspacePath()` (`src/security/path-guard.ts`), which realpaths and
  rejects anything outside the workspace root (including symlink escapes and
  `../` traversal).
- File deletion is only reachable through a modal confirmation
  (`Hygiene: Delete File`); the underlying `hygiene.cleanup` command defaults
  to dry-run and requires an explicit opt-in to remove files. Deletion
  operates on the directory entry itself, so deleting a symlink never removes
  its target, and directories are refused.
- Logging redacts token-shaped content by default
  (`meridian.security.logging.sensitive`, default `redact`).

## Reporting a vulnerability

Please open a [GitHub security advisory](https://github.com/scscodes/meridian/security/advisories/new)
or a private report rather than a public issue. Include reproduction steps and
the extension/VS Code versions. Reports are typically acknowledged within a
week.
