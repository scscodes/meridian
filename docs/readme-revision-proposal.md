# README Revision Proposal

**Status:** Shelved — pending follow-up on feature accuracy before drafting prose.
**Date:** 2026-03-30

---

## Current Problems

1. **Architecture-first, not user-first.** The four sections (Git AI, Code Hygiene, Workflows & Agents, Chat & Copilot) mirror internal domain boundaries. A developer evaluating the extension doesn't think in domains — they think in tasks and time savings.

2. **No value hook.** The opening line is descriptive ("AI-powered git, code hygiene, and workflow tools") but doesn't answer *why should I install this*. It reads like a feature spec, not a pitch.

3. **Wall of tables.** ~50 lines of command tables, ~12 for slash commands, ~10 for config. This is reference material that belongs in FEATURES.md (which already exists). On the Marketplace, it produces a long scroll with no clear focal point.

4. **Everything at equal weight.** Smart Commit and `meridian.git.refresh` get the same visual prominence. Killer features don't stand out from utility commands.

5. **No getting started path.** No "install, try this, see value" flow. A developer skimming the Marketplace has about 10 seconds to decide.

6. **Screenshots buried.** They sit between feature bullets and command tables — the least scannable zone.

---

## Guiding Principles

- **The README is a pitch, not a manual.** Its job on the Marketplace is to get someone to click Install in under 60 seconds of scanning. Reference material lives in FEATURES.md.
- **Organize by developer workflow, not internal domains.** Commit → ship → orient → maintain.
- **Prioritize dev time savers, QoL improvements, and ease of use** over exhaustive feature catalogs.
- **Short sentences, active voice, concrete verbs.** No architecture jargon, no em-dash-heavy compound bullets.

---

## Rejected Approaches

### Problem → Solution framing
Organizing each feature as "pain point → Meridian fixes it" is formulaic and infomercial-like. Not every feature maps to a pain point — analytics and impact analysis are discovery-based. Developers aren't looking for sympathy about their workflow; they're looking for tools that are better than what they have.

### Copilot-Chat-first positioning
`@meridian` is a delivery mechanism, not a feature. Leading with "talk to Meridian in chat" tells you nothing about what you'd say or why you'd bother. It belongs in the story as a "how it ties together" moment, not the opening pitch.

### `<details>` blocks for reference tables
If command tables don't belong in the README's main flow, they don't belong in the README at all. Hiding content behind collapsible sections says "I know this doesn't belong here but I'm afraid to cut it." That's still clutter, just with a toggle.

---

## Proposed Structure

### Narrative arc

1. **What is this** — one sentence mental model
2. **Why it matters** — 2-3 sentences capturing the overall proposition
3. **What it does** — 4 top capabilities in workflow order, each concrete enough to evaluate
4. **Power features** — brief mention of workflows/agents for advanced users
5. **Where to go deeper** — docs links, requirements, license

### Capability ordering

Follows a natural development cycle. Biggest time-savers first.

1. **Smart Commit** — everyone commits; biggest "I didn't know I needed this" moment
2. **Pull Requests** — direct time savings on the most common drudge work
3. **Session Briefing & Analytics** — context and orientation; differentiator
4. **Code Health** — ongoing maintenance; rounds out the story

### Outline

```
# Meridian

One-line description: what it does for you, not what categories it occupies.

2-3 sentence value statement. Answers "why install this?" without listing features.
Mentions the three interaction surfaces (palette, sidebar, @meridian chat) in
passing, not as a separate section.

---

## Smart Commit

3-4 sentences. Collects all uncommitted changes (staged and unstaged), clusters
them by structural proximity (shared directory, file type, change type), and
generates a conventional-commit message for each group using deterministic rules
(not LLM). Two-phase approval UI: multi-select picker to choose which groups to
commit, then per-group message editor. Each approved group becomes a separate
commit. Emphasize: one command replaces the manual stage-message-commit cycle.

Screenshot or GIF: the quick-pick approval UI.

## Pull Requests

Short paragraph. Three PR capabilities as a unified workflow: generate description
from branch diff (title, summary, grouped changes, test plan), AI code review
with a per-PR verdict (approve / request-changes / comment) and per-file comments
tagged by severity (critical / suggestion / nit), and targeted inline comment
generation. Emphasize: full PR cycle without leaving the editor.

No screenshot (output is text — screenshot of text isn't compelling).

## Session Briefing & Analytics

Short paragraph covering both:
- Session Briefing: AI-generated markdown summary of branch state, recent commits
  (last 10), uncommitted file list, and workspace flags (large change count,
  detached HEAD). Copied to clipboard. Start your day with context.
- Analytics: code churn, file volatility, authorship, commit trends dashboard.
  JSON/CSV export.

Screenshot: the analytics dashboard (most visually interesting asset).

## Code Health

Short paragraph covering hygiene scanning and impact analysis:
- Scan: dead files, unused exports, oversized logs, stale docs. One-click cleanup
  with dry-run.
- Impact Analysis: trace blast radius of a change — importers, call sites, test
  coverage.

Screenshot: sidebar scan results or impact analysis output.

---

## Workflows & Agents

2-3 sentences. Power-user feature — JSON-defined multi-step automation, reusable
agent profiles. Link to docs for details.

---

## Documentation

Links to ARCHITECTURE.md, FEATURES.md (full command list, config, slash commands,
LM tools), ROADMAP.md.

## Requirements

VS Code 1.90+, Node.js 22+

## License

MIT
```

### What gets cut from the README entirely

All of the following already exist in FEATURES.md:

- Command tables (all 5)
- Slash command table
- LM Tools paragraph
- Configuration table
- Sidebar Views section (folded into the value statement as a one-liner)

### What changes in tone

- Short sentences, active voice
- Concrete: "collects your uncommitted changes, clusters them by type, and
  suggests a commit message for each group" instead of "groups staged changes by
  semantic type, suggests messages via LLM, and commits in batch with an
  interactive approval UI"
- No domain jargon (command routing, Result monad, etc.)
- Each feature: heading + short paragraph + optional visual. No nested bullets or
  tables.

---

## Open Items

Before drafting prose, need to verify accuracy of feature descriptions:

- [x] Smart Commit: all changes (not just staged), deterministic grouping + messages (not LLM), two-phase UI (group picker → message editor), separate commit per group, self-stages
- [x] PR Generation: title (conventional commit), summary, grouped changes, test plan — no "risk assessment"
- [x] PR Review: single per-PR verdict (approve/request-changes/comment), per-file comments with severity (critical/suggestion/nit)
- [x] PR Comments: per-file/per-line inline comments, actionable feedback, line numbers optional
- [x] Session Briefing: branch state, last 10 commits, uncommitted files, flags (large count, detached HEAD) — no conflict detection
- [ ] Analytics: confirm chart types and export formats available
- [ ] Hygiene Scan: confirm detection categories and cleanup flow
- [ ] Impact Analysis: confirm what's traced (importers, call sites, test coverage, LLM summary?)
- [ ] Workflows: confirm current capabilities (retries, timeouts, conditional routing)
- [ ] Agents: confirm what agent profiles can do

These should be validated against current source before writing the final copy.
