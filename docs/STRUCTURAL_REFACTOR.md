# Structural Refactor Sprint — Living Doc

## AI-1: Shared TTL Cache Utility
**Status**: DONE
**Files touched**: `src/infrastructure/cache.ts` (new), `tests/cache.test.ts` (new), `src/domains/hygiene/analytics-service.ts`, `src/domains/git/analytics-service.ts`, `src/domains/hygiene/impact-analysis-handler.ts`
**Gate**: tsc 0 errors, vitest 231/231 pass (10 new cache tests)
**Note**: telemetry.ts `commandFrequency` is a simple counter, not a TTL cache — skipped as planned.

## AI-2: Extract Pure Logic from Heavy Files
**Status**: DONE
**Files touched**: `src/domains/hygiene/analytics-utils.ts` (new), `src/domains/hygiene/impact-visitor.ts` (new), `src/domains/workflow/validation.ts` (new), `src/domains/hygiene/analytics-service.ts`, `src/domains/hygiene/impact-analysis-handler.ts`, `src/domains/workflow/service.ts`, `tests/analyticsUtils.test.ts` (new), `tests/workflowValidation.test.ts` (new)
**Gate**: tsc 0 errors, vitest 266/266 pass (35 new tests across analytics-utils + workflow-validation)

## AI-3: Prose Prompt Registry
**Status**: pending
**Files touched**: TBD
**Gate**: pending

## AI-4: Webview Provider Base Class
**Status**: pending
**Files touched**: TBD
**Gate**: pending

## AI-5: Decompose main.ts
**Status**: pending
**Files touched**: TBD
**Gate**: pending

## AI-6: Consolidate Telemetry + Logging Middleware
**Status**: pending
**Files touched**: TBD
**Gate**: pending

## AI-7: Centralize File Exclusion Patterns
**Status**: pending
**Files touched**: TBD
**Gate**: pending
