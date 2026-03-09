# ADR 007 — Workflow Tree Step Expansion

**Date**: 2026-03-09
**Status**: Accepted

---

## Context

`WorkflowTreeProvider` displays available workflows in the sidebar. When a workflow runs, `specialized-commands.ts` calls `setLastRun(name, success, duration)` — but `RunWorkflowResult` also carries `stepResults: StepResult[]` (ordered array of per-step pass/fail with optional error text). That data was never stored in the provider and was silently discarded. The tree showed only workflow name + total duration — no visibility into which steps passed or failed.

Additionally, all `WorkflowTreeItem` instances were constructed with `TreeItemCollapsibleState.None` and `getChildren` returned `[]` for any non-root element, making step-level expansion structurally impossible regardless of available data.

The tree was also using `element.label as string` to key into the `lastRuns` Map — a fragile cast because `vscode.TreeItem.label` is typed as `string | vscode.TreeItemLabel`.

---

## Decision

Expand `WorkflowTreeProvider` to store and display step-level results as collapsible children of completed workflow items.

**Data model change:** `lastRuns` widens from `Map<string, { success: boolean; duration: number }>` to `Map<string, { success: boolean; duration: number; stepResults: StepResult[] }>`.

**New tree item class:** `WorkflowStepTreeItem extends vscode.TreeItem` — one instance per step, label = `stepId`, icon = `ThemeIcon("pass")` or `ThemeIcon("error")`, description = error text (if any). No inline command — step items are read-only.

**Typed lookup property:** `WorkflowTreeItem` gains a `workflowName: string` property, used for all `lastRuns` Map lookups instead of `label as string`.

**Collapsible state:** Workflow items become `TreeItemCollapsibleState.Collapsed` after a run completes with at least one step result. Items with no prior run remain `None`.

**Re-run intermediate state:** `setRunning` clears `stepResults` from `lastRuns` before the new run starts, so stale children from the previous run are not visible while execution is in progress.

**Bidirectional wiring:** `WorkflowTreeProvider` is passed to `createChatParticipant` (via `main.ts`) so that chat-triggered `workflow.run` dispatches also call `setLastRun` after completion. The `setRunning` spinner is only achievable for panel-triggered runs (see Known Limitation below).

---

## Alternatives Considered

**Output terminal only (current state):** Rejected. The terminal is ephemeral — results scroll away and cannot be revisited without re-running. There is no per-step interaction. The output channel is the wrong surface for an ordered pass/fail sequence (per ADR 006).

**Webview panel for workflow results:** Rejected. A single workflow run produces an ordered list of step results — no chart, no table with sort/filter, no historical aggregation. The cost of a new `index.html` + `script.js` + `styles.css` is not justified when tree expansion covers the use case with zero new UI infrastructure.

**Inline description text only:** Rejected. `vscode.TreeItem.description` renders a single line next to the label. It cannot enumerate multiple steps with individual pass/fail indicators. The description field is used for the summary (duration + success icon); step detail requires dedicated child items.

---

## Known Limitation

The `setRunning` spinner (loading animation) is achievable for panel-triggered runs because `specialized-commands.ts` calls it before `router.dispatch`. Chat-triggered runs that go through `chat.delegate` complete inside the domain handler before the result returns to the caller — there is no pre-execution hook available without modifying the delegate domain handler or introducing a shared EventEmitter. `setLastRun` (step results after completion) IS achievable for both paths. The spinner for chat-triggered runs is deferred to a future sprint when a broader pre-execution signaling pattern is designed.

---

## Consequences

**Good:**
- Users can expand a completed workflow item in the sidebar and see exactly which steps passed or failed, without opening the output channel.
- Step children persist in the tree for the duration of the VS Code session — navigable even after the output channel has scrolled past the run.
- Re-run state is clean: stale children are cleared before the new run begins.
- The `label as string` footgun is eliminated.

**Watch out:**
- `lastRuns` stores only the most recent run per workflow. If a user runs a workflow twice, the first run's step data is overwritten. This is intentional for v1 — the tree is a "last run" surface, not a history surface. Run history belongs in a future webview panel.
- Step items have no click command. If a future requirement calls for clicking a step to navigate to its log, that requires a new `WorkflowStepTreeItem.command` and a mechanism to store step output persistently.

---

## Reference

- `src/ui/tree-providers/workflow-tree-provider.ts` — implementation
- `src/domains/workflow/types.ts` — `StepResult`, `RunWorkflowResult`
- `src/presentation/specialized-commands.ts` — `setRunning` / `setLastRun` call site (panel path)
- `src/ui/chat-participant.ts` — `setLastRun` call site (chat path)
- `src/main.ts` — wiring `WorkflowTreeProvider` into `createChatParticipant`
