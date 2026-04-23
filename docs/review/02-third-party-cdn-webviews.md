# Topic 02 — Third-Party CDN Runtime in Webviews

## Risk Statement (Pre-Mitigation)

Analytics webviews loaded JavaScript from a public CDN at runtime, and CSP allowed that source plus broad HTTPS connect.

## Evidence (Pre-Mitigation)

- `src/domains/git/analytics-ui/index.html`
  - L4: `script-src https://cdn.jsdelivr.net ...; connect-src https:;`
  - L8: `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`
- `src/domains/hygiene/analytics-ui/index.html`
  - L4: same CSP pattern.
  - L8: same CDN script include.
- `src/infrastructure/webview-provider.ts`
  - L126-L130: local `script.js`/`styles.css` are rewritten to webview URIs, but external CDN script remains in HTML.

## Scope (Pre-Mitigation)

- Present in both analytics surfaces: Git Analytics and Hygiene Analytics.
- External request occurred when these views were opened.

## Likelihood / Impact (Pre-Mitigation)

- Likelihood: High (default behavior at the time).
- Impact: High (external code/supply-chain risk + policy violation potential).

## Viable Mitigations (Planned)

1) Vendor Chart.js locally.
- Bundle as extension asset; load via webview URI.

2) Tighten CSP.
- Remove CDN from `script-src`.
- Remove `connect-src https:` if not required by UI scripts.

3) Add build-time control.
- CI check to fail on external script URLs in webview HTML.

## Implementation Status (2026-04-23)

Status: Mitigated.

### Changes Applied

- Vendored Chart.js as a pinned local dependency:
  - `package.json`: `dependencies.chart.js = ^4.5.1`
- Removed CDN script include from both analytics webviews:
  - `src/domains/git/analytics-ui/index.html`
  - `src/domains/hygiene/analytics-ui/index.html`
- Tightened CSP in both analytics webviews:
  - Removed CDN from `script-src`
  - Set `connect-src 'none'` (no broad outbound webview network access)
- Ensured local runtime packaging during build:
  - `package.json` `copy-assets` copies `node_modules/chart.js/dist/chart.umd.js` into:
    - `out/domains/git/analytics-ui/chart.umd.js`
    - `out/domains/hygiene/analytics-ui/chart.umd.js`
- Extended host-side webview URI rewriting so local vendor runtime is always converted to webview-safe URI:
  - `src/infrastructure/webview-provider.ts` now rewrites `chart.umd.js` with `asWebviewUri(...)`
- Added regression policy tests:
  - `tests/webview-security.test.ts`
    - fails on any `http(s)` script src in analytics webview HTML
    - fails if analytics webview CSP permits CDN script origin
    - fails if analytics webview CSP allows broad `connect-src https:`

### Residual Notes

- `img-src` retains `https:` allowance in analytics webviews for non-script image loading; this does not reintroduce third-party code execution.

## Current State / Assessment

- Current runtime state: mitigated for Topic 02 scope (Git Analytics and Hygiene Analytics webviews).
- CDN JavaScript execution risk: closed for these webviews (Chart.js now local extension asset only).
- CSP posture for script/connect in these webviews: tightened to local script sources and `connect-src 'none'`.
- Regression control: active (`tests/webview-security.test.ts`) and included in lint/test workflow to catch policy drift.
- Residual risk: non-script remote image allowance remains (`img-src https:`); acceptable for this topic because it does not enable third-party script execution.
- Overall assessment: likelihood reduced from High to Low; impact reduced from High to Low for this specific third-party runtime script vector.
