# Publish-Readiness Sprint

## Work Items
- [x] 1. `.vscodeignore` + `CHANGELOG.md` + `LICENSE`
- [x] 2. Wire centralized error codes (14 handler files)
- [x] 3. Fix `"test"` script (vitest → vitest run)
- [x] 7. GitHub Actions CI workflow
- [x] 9. Marketplace-facing README rewrite + `docs/ARCHITECTURE.md`
- [x] 11. package.json metadata

## Verification
- [x] `npx tsc --noEmit` — zero errors
- [x] `npx vitest run` — 144/144 pass, zero regressions
- [x] `git diff --stat` — 28 files changed, scoped correctly
- [x] Spot-check: error codes clean in all handlers, README reads well, `.vscodeignore` correct

## Notes
- Media filenames fixed: `anlaytics` → `analytics` (2 PNG files)
- 10 missing error constants added to `error-codes.ts`
- Remaining inline error codes are in `service.ts` init paths (out of scope)
- `out/` diffs are pre-existing from prior build; not part of this sprint
