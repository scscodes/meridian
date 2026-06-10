# Meridian Command Reference

**Meridian** is a computed-insight instrument panel for your repository. It exposes git analytics, workspace hygiene, change blast-radius, and a session briefing through commands, sidebar views, and webview dashboards — all backed by explicit error handling and structured logging. It does not wrap an LLM around commodity dev actions. (See [ADR 012](./adr/012-product-reanchor.md) for the 2.0 re-anchor.)

This document describes all user-accessible features, organized by domain.

---

## Git Domain

Version-control state plus computed analytics.

### **git.status**
Read-only. Returns current branch name, dirty state (clean/dirty), and counts of staged, unstaged, and untracked files. Use this to monitor local state before operations.

### **git.pull**
Fetch and merge changes from the remote. Pulls the current branch (or a specified branch) with full error reporting for merge conflicts and network issues.

### **git.commit**
Create a commit with a provided message. Validates the message, with comprehensive error handling for detached states or a dirty index.

### **git.showAnalytics**
Open a full-screen dashboard displaying Git analytics: churn (commits per file), volatility (recent change frequency), authorship (commits per author), commit trends (over time), and top contributors. Includes a **Risk Hotspots** scatter — each file plotted by change frequency (x) against volatility (y), bubble size by total lines changed, colored by risk tier — so refactor candidates surface in the top-right at a glance. A **Change Companions** table surfaces files that change together in the same commit (co-change count + co-change rate), revealing hidden coupling — candidates to refactor together or split apart. Real-time chart rendering with drill-down.

**Export (all report dashboards).** Each report webview (Git Analytics, Hygiene Analytics, Session Briefing) offers two save paths: **↓ CSV / ↓ JSON** quick-save the report dialog-free to `.meridian/artifacts/` with a timestamped filename (per [ADR 014](./adr/014-dotdir-doctrine.md); the dir self-ignores so artifacts never enter git), and **Save as…** opens a dialog (format + location) for saving anywhere.

### **git.sessionBriefing**
Generate a session-orientation summary. Aggregates git working-tree status, recent commits, run-log activity (`recentRuns`), git analytics (`activityWindow` — including momentum trends and a commit-frequency sparkline showing the shape behind the trend arrow), hygiene scan state (`hygieneSnapshot`), and a pending-change risk preview (`pendingChangeRisk` — each uncommitted file joined against the computed analytics risk model: churn, volatility, and risk tier, with files absent from the analytics window marked `new` (no history) or `cold` (changed but quiet — low, not unknown); a flag is raised when several high-risk files are in flight), and a pending-change companion preview (`pendingChangeCompanions` — files that historically ship in the same commit as your current edits but are not in the dirty set yet, i.e. possibly-forgotten siblings such as tests/types/docs; a flag is raised when several are likely missing) into a deterministic `SessionBriefing` record, then layers optional AI prose on top. Optional slices degrade gracefully when data is unavailable; the prose layer degrades to the raw aggregate when no language model is available. Useful for standup notes, context switching, pre-commit risk triage, or morning orientation.

---

## Hygiene Domain

Workspace analysis and cleanup: dead code, large files, stale logs, change impact.

### **hygiene.scan**
Scan the workspace for cleanup candidates:
- **Dead files**: unused imports, orphaned modules (via the TypeScript Compiler API)
- **Dead code**: unused exports, locals, and parameters
- **Large files**: above the configured size threshold
- **Log files**: stale `.log` files above age and size thresholds
- **Markdown files**: documentation artifacts for review or archival

Respects `.gitignore` and `.meridian/.meridianignore` patterns. Returns a categorized list with file paths, sizes, ages, and reasons.

### **hygiene.cleanup**
Delete specified files. Batch removal of candidates surfaced by `hygiene.scan`. Defaults to dry-run: deletion happens only with an explicit `dryRun: false`, and the user-facing path (**Delete File**) requires a modal confirmation first. Not exposed in the command palette.

### **hygiene.impactAnalysis**
Trace the blast radius of a file or function change by analyzing imports, call sites, and test coverage via the TypeScript Compiler API. Returns importers, call sites, dependent file count, test coverage, and an optional prose summary (when a language model is available). Helps assess refactor/removal risk.

### **hygiene.showAnalytics**
Open a dashboard displaying Hygiene analytics: prune candidates over time, file-type breakdown, disk impact (total and per-category), and age/size distributions. Configurable thresholds via workspace settings.

### File actions (sidebar / explorer context)
- **Delete File** — remove a file flagged by the last scan (confirmation required).
- **Ignore File** — append the file's pattern to `.meridian/.meridianignore`.

---

## Sidebar Views & UI

### **Panel Reports View** (`meridian.reports.view`)
First view in the Meridian activity-bar container — the anchored, first-class entry point for the three webview reports, in order: **Session Briefing**, **Git Analytics**, **Hygiene Analytics**. Report rows carry no glyphs by design. Single-click (or the hover **View** action, `$(open-preview)`) reveals a live panel without recomputing, or runs the report once if no panel is open. The hover **Refresh** action (`$(refresh)`) always recomputes. The former in-tree "View Git Report" / "View Hygiene Report" nodes and the Git/Hygiene view-title report icons were removed — report entry now lives exclusively here.

### **Git View** (`meridian.git.view`)
Browse current branch, dirty state, change groups (staged/unstaged/untracked, expandable to files), and recent commits. The Git Analytics report is reached via the Panel Reports view.

### **Hygiene View** (`meridian.hygiene.view`)
Browse hygiene scan results (dead files, dead code, large files, logs, markdown) and the latest impact-analysis result. Context actions to delete or ignore flagged files. The Hygiene report is reached via the Panel Reports view.

### **Status Bar**
Real-time Git status indicator (branch, dirty state, change counts). Click to open a Quick Pick with top actions (Session Briefing, Hygiene Scan, Impact Analysis, Git Analytics, Hygiene Analytics, Refresh All).

---

## Configuration

All features respect workspace settings under the `meridian.*` namespace, including:

- `meridian.hygiene.prune.minAgeDays` — Minimum file age (days) before a file is a prune candidate (number, default: 30)
- `meridian.hygiene.prune.maxSizeMB` — Files larger than this (MB) are flagged when also older than `minAgeDays` (number, default: 1)
- `meridian.hygiene.prune.minLineCount` — Files with this many lines or more are flagged when also older than `minAgeDays`; 0 disables (number, default: 0)
- `meridian.sessionBriefing.autoLaunch` — Open a Session Briefing on activation (boolean, default: false)
- `meridian.startup.enableFileWatchers` — Register file watchers for auto tree/status refresh (boolean, default: true)

### Workspace dotdir (`.meridian/`)

Per-workspace Meridian state lives under `.meridian/` at the workspace root (see [ADR 014](./adr/014-dotdir-doctrine.md)):

- `.meridian/.meridianignore` — gitignore-syntax patterns excluded from hygiene scans. Editor syntax highlighting is provided via the built-in `ignore` language association. Legacy `.meridianignore` at the workspace root is auto-relocated on activation.
- `.meridian/settings.json` — sparse JSON overrides for `meridian.*` settings. Present keys take precedence over VS Code user/workspace settings; absent keys fall through. Example: `{ "hygiene.prune.minAgeDays": 7 }`.

---

## Output & Results

Commands surface results via the surface best matched to their output type (see [ADR 006](./adr/006-rendering-surface-decision-matrix.md)):
- **Webview Panels** — analytics dashboards (Git, Hygiene) and the session briefing, with full-screen charts and tables
- **Tree Panel** — branch state, change groups, scan results, impact-analysis expansion
- **Output Channel** (`Meridian`) — long-form prose (session briefing, impact summary) and diagnostics
- **Notifications** — success/error toasts; errors where the output channel holds diagnostic detail include a "Show Output" action button
- **Clipboard** — selected outputs (session briefing summary, impact analysis) auto-copy for pasting

---

## Extensibility

Domains, handlers, and middleware are designed for extension:
- Add custom commands by implementing a new domain and handler
- Chain middleware for custom auth, rate-limiting, or observability

See the ADRs in [docs/adr/](./adr/) for extension points and patterns.
