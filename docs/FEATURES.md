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
Open a full-screen dashboard displaying Git analytics: churn (commits per file), volatility (recent change frequency), authorship (commits per author), commit trends (over time), and top contributors. Real-time chart rendering with drill-down.

### **git.exportJson**
Export the current Git analytics report (churn, volatility, authorship, trends) as JSON for external processing, CI/CD integration, or archival.

### **git.exportCsv**
Export Git analytics to CSV (one row per file or author, with metrics columns) for spreadsheet analysis or reporting.

### **git.sessionBriefing**
Generate a session-orientation summary. Aggregates git working-tree status, recent commits, run-log activity (`recentRuns`), git analytics (`activityWindow`), and hygiene scan state (`hygieneSnapshot`) into a deterministic `SessionBriefing` record, then layers optional AI prose on top. Optional slices degrade gracefully when data is unavailable; the prose layer degrades to the raw aggregate when no language model is available. Useful for standup notes, context switching, or morning orientation.

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

Respects `.gitignore` and `.meridianignore` patterns. Returns a categorized list with file paths, sizes, ages, and reasons.

### **hygiene.cleanup**
Delete specified files with optional dry-run mode. Batch removal of candidates surfaced by `hygiene.scan`. Requires user confirmation before deletion.

### **hygiene.impactAnalysis**
Trace the blast radius of a file or function change by analyzing imports, call sites, and test coverage via the TypeScript Compiler API. Returns importers, call sites, dependent file count, test coverage, and an optional prose summary (when a language model is available). Helps assess refactor/removal risk.

### **hygiene.showAnalytics**
Open a dashboard displaying Hygiene analytics: prune candidates over time, file-type breakdown, disk impact (total and per-category), and age/size distributions. Configurable thresholds via workspace settings.

### File actions (sidebar / explorer context)
- **Delete File** — remove a file flagged by the last scan (confirmation required).
- **Ignore File** — append the file's pattern to `.meridianignore`.

---

## Sidebar Views & UI

### **Git View** (`meridian.git.view`)
Browse current branch, dirty state, change groups (staged/unstaged/untracked, expandable to files), and recent commits. Inline action to open the Git Analytics report.

### **Hygiene View** (`meridian.hygiene.view`)
Browse hygiene scan results (dead files, dead code, large files, logs, markdown) and the latest impact-analysis result. Inline actions to delete or ignore flagged files.

### **Status Bar**
Real-time Git status indicator (branch, dirty state, change counts). Click to open a Quick Pick with top actions (Session Briefing, Hygiene Scan, Impact Analysis, Git/Hygiene Analytics, Refresh All).

---

## Configuration

All features respect workspace settings under the `meridian.*` namespace, including:

- `meridian.git.autofetch` — Auto-fetch on open (boolean, default: false)
- `meridian.hygiene.enabled` — Enable scans and analytics (boolean, default: true)
- `meridian.hygiene.prune.minAgeDays` — Minimum file age (days) before a file is a prune candidate (number, default: 30)
- `meridian.hygiene.prune.maxSizeMB` — Files larger than this (MB) are flagged when also older than `minAgeDays` (number, default: 1)
- `meridian.hygiene.prune.minLineCount` — Files with this many lines or more are flagged when also older than `minAgeDays`; 0 disables (number, default: 0)
- `meridian.sessionBriefing.autoLaunch` — Open a Session Briefing on activation (boolean, default: false)
- `meridian.startup.enableFileWatchers` — Register file watchers for auto tree/status refresh (boolean, default: true)
- `meridian.log.level` — Logger verbosity: debug, info, warn, error (default: info)

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
