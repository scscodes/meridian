# Meridian

**A computed-insight instrument panel for your repository — without leaving VS Code.**

Git analytics, workspace hygiene, change blast-radius, and a session briefing. Deterministic and inspectable: it shows you what your repo is doing, it doesn't wrap an LLM around commodity dev actions. Drive it from the Meridian sidebar or the command palette.

---

## What it does

- **Git Analytics** — churn, file volatility, and authorship in one dashboard, with JSON and CSV export for reporting or downstream analysis.
- **Code Health** — Hygiene Scan finds dead files, dead code (unused imports, locals, params), large files, and stale logs; dry-run, then clean in one pass.
- **Impact Analysis** — traces importers, call sites, and test coverage via the TypeScript compiler API so you size the blast radius before you refactor.
- **Session Briefing** — branch state, recent commits, uncommitted files, recent run activity, hygiene snapshot, and risk flags (large changesets, detached HEAD) in one read. Start the day oriented; re-orient after a branch switch.

All four are computed surfaces — no model calls required to produce them. The session briefing optionally adds a prose summary when a language model is available, and degrades cleanly to the raw aggregate when it isn't.

---

## Getting started

Open the Command Palette and search `Meridian`, or use the Meridian sidebar (Reports, Git, and Hygiene views). Configure under **Settings** → `meridian.*`.

- **Requires** VS Code 1.91+
- **Works in** VS Code, Cursor, VSCodium, and compatible editors — via the VS Marketplace and Open VSX
- **License** MIT
