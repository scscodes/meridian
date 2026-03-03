# Refactor: Break Git & Hygiene Domain Monoliths

**Goal:** Split oversized service.ts and handlers.ts files into focused, single-responsibility modules.
**Constraint:** Zero functional changes — pure file-level decomposition only.

---

## Context & Findings

### Git Domain (the primary concern)
| File | Lines | Problem |
|------|-------|---------|
| service.ts | 1050 | 4 unrelated classes bundled together + circular import with handlers.ts |
| handlers.ts | 773 | 9 handlers + 3 helpers, all in one file |

**Circular dependency (must fix):** `service.ts` imports handler factories from `handlers.ts`; `handlers.ts` imports service classes from `service.ts`. This is a ticking time bomb.

### Hygiene Domain (lower severity)
| File | Lines | Problem |
|------|-------|---------|
| handlers.ts | 280 | Two conceptually distinct handlers + shared helpers mixed together |
| service.ts | 103 | Fine as-is |

---

## ADR: Decomposition Strategy

**Decision:** Flat file layout (no subdirectories). Each new file = one cohesive cluster of related logic.

**Rationale:**
- Subdirectories add indirection without benefit at this scale
- Existing analytics files are already peers — stay consistent
- index.ts barrel exports hide internal layout from consumers anyway

**Circular dependency fix:**
- Service classes move OUT of service.ts into dedicated files
- handlers.ts imports from those new files (not service.ts)
- service.ts (GitDomainService) imports from both — no cycle

---

## Phase 1: Git Domain — Service Split

Break `service.ts` (1050 lines) into 3 focused files + a thin orchestrator.

### Files to create

**`src/domains/git/smart-commit-service.ts`** (~400 lines)
- Move: `ChangeGrouper` class (lines 68–116)
- Move: `CommitMessageSuggester` class (lines 127–247)
- Move: `BatchCommitter` class (lines 268–360)
- These 3 classes form the smart commit pipeline; no dependencies on handlers

**`src/domains/git/inbound-analyzer.ts`** (~350 lines)
- Move: `InboundAnalyzer` class (lines 381–904)
- Standalone remote analysis + conflict detection pipeline
- No dependency on smart commit or handlers

**`src/domains/git/service.ts`** shrinks to ~100 lines
- Keep: `GitDomainService` class only (constructor, initialize, teardown)
- Remove: all 4 inner classes (moved above)
- Imports from: `smart-commit-service.ts`, `inbound-analyzer.ts`, handlers files

### Checklist
- [ ] Create `smart-commit-service.ts` — extract ChangeGrouper, CommitMessageSuggester, BatchCommitter
- [ ] Create `inbound-analyzer.ts` — extract InboundAnalyzer
- [ ] Trim `service.ts` to GitDomainService only
- [ ] Update imports in `service.ts`
- [ ] Update `index.ts` to re-export new modules if needed
- [ ] Run `npx tsc --noEmit` — zero errors
- [ ] Run `npx vitest run` — zero regressions

---

## Phase 2: Git Domain — Handler Split

Break `handlers.ts` (773 lines) into 3 focused files + a thin remnant.

### Files to create

**`src/domains/git/smart-commit-handler.ts`** (~155 lines)
- Move: `createSmartCommitHandler` (the complex 155-line handler)
- Imports from: `smart-commit-service.ts` (not from service.ts — fixes circular dep)

**`src/domains/git/pr-handlers.ts`** (~145 lines)
- Move: `createGeneratePRHandler`, `createReviewPRHandler`, `createCommentPRHandler`, `createResolveConflictsHandler`
- Move: shared helpers `gatherPRContext()`, `parseNumstatOutput()`, `parseFileChanges()`
- These 4 handlers all share the PR context gathering pattern

**`src/domains/git/inbound-handler.ts`** (~41 lines)
- Move: `createAnalyzeInboundHandler`
- Imports from: `inbound-analyzer.ts` (not from service.ts — fixes circular dep)

**`src/domains/git/handlers.ts`** shrinks to ~90 lines
- Keep: `createStatusHandler`, `createPullHandler`, `createCommitHandler` (simple wrappers)
- These are basic git ops with no service class dependency

### Checklist
- [ ] Create `smart-commit-handler.ts` — imports from smart-commit-service.ts
- [ ] Create `pr-handlers.ts` — move 4 PR handlers + gatherPRContext + parse helpers
- [ ] Create `inbound-handler.ts` — imports from inbound-analyzer.ts
- [ ] Trim `handlers.ts` to 3 basic git handlers
- [ ] Verify `service.ts` (GitDomainService constructor) updates its handler imports
- [ ] Run `npx tsc --noEmit` — zero errors
- [ ] Run `npx vitest run` — zero regressions

---

## Phase 3: Hygiene Domain — Handler Split

Break `handlers.ts` (280 lines) into 2 focused files.

### Files to create

**`src/domains/hygiene/scan-handler.ts`** (~130 lines)
- Move: `createScanHandler`
- Move: `readGitignorePatterns()`, `readMeridianIgnorePatterns()`, `isExcluded()` helpers

**`src/domains/hygiene/cleanup-handler.ts`** (~85 lines)
- Move: `createCleanupHandler`
- Move: `CleanupParams` and `CleanupResult` interfaces

**`src/domains/hygiene/handlers.ts`** → delete or make a thin re-export barrel
- Nothing substantive remains; either delete and update service.ts imports directly, or keep as a barrel for backwards compat

### Checklist
- [ ] Create `scan-handler.ts` — scan handler + ignore pattern helpers
- [ ] Create `cleanup-handler.ts` — cleanup handler + interfaces
- [ ] Update `service.ts` imports (was importing from handlers.ts)
- [ ] Update `index.ts` re-exports
- [ ] Run `npx tsc --noEmit` — zero errors
- [ ] Run `npx vitest run` — zero regressions

---

## Post-Refactor File Layout

```
src/domains/git/
  service.ts              ~100 lines  (GitDomainService only — orchestrator)
  handlers.ts             ~90 lines   (status, pull, commit — basic wrappers)
  smart-commit-service.ts ~400 lines  (ChangeGrouper, MessageSuggester, BatchCommitter)
  smart-commit-handler.ts ~155 lines  (createSmartCommitHandler)
  inbound-analyzer.ts     ~350 lines  (InboundAnalyzer class)
  inbound-handler.ts      ~41 lines   (createAnalyzeInboundHandler)
  pr-handlers.ts          ~145 lines  (4 PR handlers + shared context helpers)
  types.ts                unchanged
  analytics-service.ts    unchanged
  analytics-handler.ts    unchanged
  analytics-types.ts      unchanged
  index.ts                updated re-exports

src/domains/hygiene/
  service.ts              unchanged (103 lines)
  scan-handler.ts         ~130 lines  (createScanHandler + ignore helpers)
  cleanup-handler.ts      ~85 lines   (createCleanupHandler + interfaces)
  analytics-service.ts    unchanged
  analytics-handler.ts    unchanged
  analytics-types.ts      unchanged
  dead-code-analyzer.ts   unchanged
  handlers.ts             → delete (or thin barrel)
  index.ts                updated re-exports
```

---

## Implementation Order

1. Phase 1 (git service split) first — establishes new imports for Phase 2
2. Phase 2 (git handler split) — depends on Phase 1 files existing
3. Phase 3 (hygiene handler split) — independent, can do anytime after Phase 1+2 complete

Each phase must pass `npx tsc --noEmit` + `npx vitest run` before starting the next.

---

## Review
_To be filled in after implementation._
