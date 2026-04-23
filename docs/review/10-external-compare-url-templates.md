# Topic 10 — External Compare URL Template Generation

## Observation

Code constructs compare URLs for external git hosting platforms.

## Evidence

- `src/domains/git/inbound-analyzer.ts`
  - L513: GitHub compare URL template.
  - L523: GitLab compare URL template.
  - L533: Bitbucket compare URL template.

## Scope

- Current evidence is URL generation logic.
- Lower risk unless URLs are auto-opened or silently transmitted.

## Likelihood / Impact

- Likelihood: Medium (depends on inbound analysis usage paths).
- Impact: Low (informational/contextual in current evidence).

## Suggested Control

- Keep behavior documented and avoid automatic browser open without explicit user action.
