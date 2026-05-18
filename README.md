# Meridian

**Less toil between your local changes and review-ready output — without leaving VS Code.**

Clean grouped commits, generated PR docs, and the codebase context you actually need. Drive it from the command palette, the sidebar, or `@meridian` in Copilot Chat.

---

## What it does

- **Smart Commit** — bundles your staged *and* unstaged work into grouped commits with messages derived from what changed, not LLM guesses. You pick the groups, edit any message, confirm — each group lands as its own commit.
- **Pull Requests** — generate the description (title, summary, grouped changes, test plan), run an AI review for a single verdict with per-file comments by severity, or get targeted inline feedback on specific files.
- **Session Briefing** — branch state, recent commits, uncommitted files, and risk flags (large changesets, detached HEAD) in one read. Start the day oriented; re-orient after a branch switch.
- **Git Analytics** — churn, volatility, and authorship in one dashboard, with JSON and CSV export for reporting or downstream analysis.
- **Code Health** — Hygiene Scan finds dead files, dead code (unused imports, locals, params), large files, and stale logs; dry-run, then clean in one pass. Impact Analysis traces importers, call sites, and test coverage so you size the blast radius before you refactor.
- **Workflows & Agents** — JSON-defined automation with retries, timeouts, and conditional step routing; agents wrap approved commands and workflow targets into reusable execution profiles.

---

## Getting started

Open the Command Palette and search `Meridian`, use the Meridian sidebar, or type `@meridian` in Copilot Chat. Configure under **Settings** → `meridian.*`.

- **Requires** VS Code 1.91+
- **Works in** VS Code, Cursor, VSCodium, and compatible editors — via the VS Marketplace and Open VSX
- **License** MIT
