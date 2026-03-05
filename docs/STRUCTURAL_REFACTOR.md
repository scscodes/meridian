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
**Status**: DONE
**Files touched**: `src/infrastructure/prompt-registry.ts` (new), `src/domains/git/pr-handlers.ts`, `src/domains/git/session-handler.ts`, `src/domains/chat/handlers.ts`, `src/domains/hygiene/impact-analysis-handler.ts`
**Gate**: tsc 0 errors, vitest 266/266 pass

## AI-4: Webview Provider Base Class
**Status**: DONE
**Files touched**: `src/infrastructure/webview-provider.ts` (rewritten)
**Gate**: tsc 0 errors, vitest 266/266 pass

## AI-5: Decompose main.ts
**Status**: DONE
**Files touched**: `src/main.ts` (705→188 lines), `src/presentation/result-presenters.ts` (new), `src/presentation/command-registry.ts` (new), `src/presentation/status-bar.ts` (new), `src/presentation/file-watchers.ts` (new), `src/presentation/tree-setup.ts` (new), `src/presentation/specialized-commands.ts` (new), `src/presentation/webview-setup.ts` (new)
**Gate**: tsc 0 errors, vitest 266/266 pass

## AI-6: Consolidate Telemetry + Logging Middleware
**Status**: DONE
**Files touched**: `src/cross-cutting/middleware.ts`, `src/main.ts`
**Gate**: tsc 0 errors, vitest 266/266 pass

## AI-7: Centralize File Exclusion Patterns
**Status**: DONE
**Files touched**: `src/constants.ts`, `src/domains/git/analytics-service.ts`
**Gate**: tsc 0 errors, vitest 266/266 pass
