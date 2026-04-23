# Security Closure Packet (Current State)

This file intentionally tracks only present-state controls and residuals.
Remediation implementation details and interim topic writeups were pruned to reduce point-in-time bloat.

## Stability Verification

- `npm run compile`: pass
- `npm test`: pass (50 files, 445 tests)

## Active security controls

- `src/security/path-guard.ts`: canonical workspace boundary enforcement.
- `src/security/lm-policy.ts`: LM egress mode gate (`allow`/`prompt`/`deny`) and payload sanitization.
- `src/security/operation-policy.ts`: clipboard policy, sensitive logging redaction, git network policy (`allow`/`prompt`/`deny`) and host allowlist.

## Enterprise-relevant settings

- `meridian.security.lmEgress.mode`
- `meridian.security.gitNetwork.mode`
- `meridian.security.gitNetwork.allowedHosts`
- `meridian.security.clipboard.autoCopy`
- `meridian.security.logging.sensitive`
- `meridian.startup.enableFileWatchers`
- `meridian.startup.enableChatSurface`

## Residual / monitor items

- `08-startup-wide-activation.md`: activation event remains startup-wide; runtime surface is configurable.
- `09-telemetry-local-sink-posture.md`: local sink posture is current state; monitor for future remote sink introduction.
- `10-external-compare-url-templates.md`: compare URL generation is low risk; keep user-explicit interaction boundaries.
