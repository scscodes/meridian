# Meridian — Roadmap

See [FEATURES.md](./FEATURES.md) for the complete feature inventory.

**Thesis:** Meridian is the structured, inspectable agent layer Copilot invokes. Typed commands + Result monad + skill/workflow composition give Copilot deterministic capabilities most extensions can't expose. Every roadmap item either deepens that surface or gets deferred.

---

## Foundations (sequence-critical, build first)

These are the substrate. Content layers below depend on them; building content first forces rework.

1. ~~**Run event log — persistence for workflow + skill executions**~~ — **DELIVERED 2026-04-20** (ADR 009). Versioned append-only store keyed by `runId`, with `start/step/complete/fail` events emitted from router, workflow engine, and skill service.

2. ~~**Pre-execution signaling hook in router/middleware**~~ — **DELIVERED 2026-04-20** (ADR 008). Router exposes `onBeforeHandler`/`onAfterHandler`; `src/presentation/dispatch-signaling.ts` wires tree spinners. Chat-delegated `workflow.run` spinner now works.

3. **LM tool result envelope — typed contract across all tools**
   - Uniform shape `{summary, data, followups, renderHint}` so Copilot receives consistent, structured output whether the tool is git, hygiene, workflow, or skill.
   - Collapses per-tool formatter drift; makes adding a new skill a schema exercise, not a rendering one.
   - Primary files: `src/ui/lm-tools.ts`, `src/infrastructure/result-handler.ts`, `src/types.ts`.

4. **Session briefing data aggregator**
   - Pure function over run log + git analytics + hygiene scan state → `SessionBriefing` record.
   - Decouples data from the webview so the same aggregate can feed chat, LM tool, and UI surfaces.
   - Primary files: `src/domains/git/session-handler.ts`, new `src/domains/git/session-aggregator.ts`.
   - Depends on #1.

---

## Content Expansion (after foundations land)

Topical, easy to tweak, safe to iterate on once the substrate is stable.

5. **Workflow run history webview**
   - Multi-run timeline, per-step drill-down, re-run action. Reads #1 directly; no new data plumbing.
   - Primary files: new `src/domains/workflow/run-history-ui/`, `src/presentation/webview-setup.ts`.

6. **Skill library expansion**
   - Additional built-in recipes: post-merge cleanup, dependency triage, release prep, branch cleanup, stale-PR sweep.
   - Each skill is thin composition over existing engine + #3 envelope — purely additive, no engine changes.
   - Primary files: `src/domains/skill/handlers.ts`, `src/domains/skill/service.ts`.

7. **Session briefing UI deepening**
   - Richer presentation over #4 aggregate: actionable cards, inline skill triggers, quick filters.
   - Primary files: `src/domains/git/session-briefing-ui/`.

8. **Skill discoverability surface**
   - Tree view or quick-pick catalog of available skills with descriptions, last-run status (from #1).
   - Only meaningful once #6 has produced a library worth browsing.

---

## Deferred

- **Remote telemetry sink** — no destination exists; #1 is the prerequisite.
- **Additional analytics chart types** — diminishing returns on existing webviews.
- **Webview message typed generics** — `BaseWebviewProvider<T, M extends WebviewMessage>`; ergonomic, not load-bearing.
- **`git.resolveConflicts` tree migration** — ADR 006 alignment; medium priority, no immediate user impact.
- **ADR 006 compliance backlog** — `hygiene.reviewFile` (streams to output channel, no richer surface), `hygiene.impactAnalysis` (error path missing "Show Output"); pre-existing, low user impact.
- **Integration & E2E coverage for webview adapters** — valuable, not a differentiator; schedule opportunistically.
