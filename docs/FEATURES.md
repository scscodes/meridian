# Meridian Command Reference

**Meridian** is a VS Code extension that brings domain-driven automation to your development workflow. Built on a composable command architecture, it exposes Git operations, workspace hygiene, workflow orchestration, and AI-powered analysis through commands, sidebar views, and Copilot Chat integration—all backed by explicit error handling and structured logging.

This document describes all user-accessible features, organized by domain.

---

## Git Domain

Core version control operations with analytics, smart commits, and PR utilities.

### **git.status**
Read-only. Returns current branch name, dirty state (clean/dirty), and counts of staged, unstaged, and untracked files. Use this to monitor local state before operations.

### **git.pull**
Fetch and merge changes from the remote. Pulls the current branch (or a specified branch) with full error reporting for merge conflicts and network issues.

### **git.commit**
Create a commit with a provided message. Validates the message and stages all changes if requested, with comprehensive error handling for detached states or dirty index.

### **git.smartCommit**
Interactive batch-commit workflow that groups unstaged changes, suggests messages via LLM, and presents an approval UI (quick-pick) before committing. Ideal for large changesets that benefit from semantic grouping.

### **git.showAnalytics**
Open a full-screen dashboard displaying Git analytics: churn (commits per file), volatility (recent change frequency), authorship (commits per author), commit trends (over time), and top contributors. Includes real-time chart rendering and drill-down capabilities.

### **git.exportJson**
Export the current Git analytics report (churn, volatility, authorship, trends) as JSON for external processing, integration with CI/CD, or long-term archival.

### **git.exportCsv**
Export Git analytics to CSV format (one row per file or author, with metrics columns) for spreadsheet analysis or reporting.

### **git.generatePR**
Analyze the current branch relative to a target branch (default: `main`), then generate a professional PR description. Includes summary, key changes, file breakdown, and risk assessment. Result is copied to clipboard and shown in the Output channel.

### **git.reviewPR**
Send the current branch diff to an LLM for a structured code review. Returns a verdict (APPROVE, REQUEST_CHANGES, COMMENT), summary, and per-file comments with severity tags. Output is copied to clipboard and displayed in the Output channel.

### **git.commentPR**
Generate inline PR comments on specific files or lines. Parses the branch diff and uses an LLM to suggest targeted, actionable comments. Results are copied to clipboard and logged to Output.

### **git.resolveConflicts**
Analyze merge conflicts in the current branch and suggest resolution strategies (ours, theirs, manual with step-by-step guidance) for each conflicted file. Output includes per-file rationale and suggested resolution steps.

### **git.sessionBriefing**
Generate a prose summary of Git activity during the current session (commits, branches, pulls, pushes, conflicts). Useful for standup notes, commit logs, or context switching. Copied to clipboard.

---

## Hygiene Domain

Workspace analysis and cleanup: identify dead code, large files, and stale logs.

### **hygiene.scan**
Scan the workspace for cleanup candidates in several categories:
- **Dead files**: Unused imports, orphaned modules (via TypeScript Compiler API)
- **Large files**: Disk space issues, above configured threshold
- **Log files**: Stale `.log` files above age and size thresholds
- **Markdown files**: Documentation artifacts for potential review or archival

Respects `.gitignore` and `.meridianignore` patterns. Returns a categorized list of candidates with file paths, sizes, ages, and reasons for inclusion.

### **hygiene.cleanup**
Delete specified files with optional dry-run mode. Ideal for batch removal of candidates surfaced by `hygiene.scan`. Respects user confirmation (warning dialog) before deletion.

### **hygiene.impactAnalysis**
Trace the blast radius of a file or function change by analyzing imports, call sites, and test coverage via the TypeScript Compiler API. Returns a prose summary (via LLM) describing which files depend on the target, which tests exercise it, and the scope of impact. Helps assess the risk of refactoring or removing code.

### **hygiene.showAnalytics**
Open a dashboard displaying Hygiene analytics: prune candidates over time (trend chart), file-type breakdown (pie chart), disk impact (total and per-category), and age/size distributions. Configurable thresholds for what counts as "large" or "stale" via workspace settings.

---

## Workflow Domain

Compose and execute automation workflows from JSON definitions.

### **workflow.list**
List all available workflows discovered from `.vscode/workflows/*.json` (and bundled assets). Returns workflow name, description, version, and step count for each.

### **workflow.run**
Execute a named workflow by orchestrating its steps in sequence. Steps can be conditional, share variables, and dispatch Meridian commands. Use this to automate repetitive tasks (e.g., "prepare PR" = status → pull → smartCommit → generatePR).

---

## Agent Domain

Define and execute autonomous agents that compose commands and workflows.

### **agent.list**
List all available agents discovered from `.vscode/agents/*.json`. Returns agent ID, description, version, declared capabilities (which commands they can run), and workflow triggers they respond to.

### **agent.execute**
Run an agent by specifying its ID, target command or workflow, and optional parameters. The agent validates it has the requested capability, then executes the target. Returns a structured execution report: success/failure, execution logs, timing, and output. Use this to automate multi-step tasks via reusable automation profiles.

---

## Chat Domain

Copilot Chat integration and context gathering.

### **chat.context**
Gather workspace context for Copilot: active file path, current Git branch, Git status (staged/unstaged/untracked counts). Returns a structured object. Useful as a preamble before delegating complex tasks to Copilot Chat.

### **chat.delegate**
Spawn a sub-agent to execute a Meridian command asynchronously and return the result. Decouples long-running operations (analytics, scans) from the chat thread, allowing Copilot to continue interacting while work proceeds in the background.

### **@meridian chat participant**
Use `@meridian` in Copilot Chat to interact with Meridian. Natural language is the primary interface — describe what you want and Meridian routes it via LLM intent classification (e.g., "show uncommitted changes", "what's the blast radius of createStatusHandler?", "run the morning sync workflow"). Slash commands (`/pr`, `/review`, `/briefing`, `/scan`, `/status`, `/workflows`, `/agents`, `/analytics`, `/conflicts`, `/context`) are accelerator shortcuts for common operations.

### **Meridian LM Tools**
Git, Hygiene, Workflow, and Agent commands are exposed as LM tools, allowing Copilot to autonomously discover and invoke Meridian features during agentic workflows.

---

## Sidebar Views & UI

### **Git View** (`meridian.git.view`)
Browse current branch, dirty state, and recent commits. Right-click to pull, commit, or run Smart Commit. Inline action buttons for common operations.

### **Hygiene View** (`meridian.hygiene.view`)
Browse hygiene scan results (dead files, large files, logs, markdown). Inline actions to delete, ignore, or request AI review of markdown files.

### **Workflow View** (`meridian.workflow.view`)
Browse available workflows with descriptions and step counts. Click to run, inline status indicators show last run result and execution time.

### **Agent View** (`meridian.agent.view`)
Browse available agents with descriptions and capabilities. Click to execute with modal parameter selection.

### **Status Bar**
Real-time Git status indicator (branch, dirty state, change counts). Click to open Quick Pick with top actions (Smart Commit, Hygiene Scan, Analytics, Refresh).

---

## Configuration

All features respect workspace settings under the `meridian.*` namespace:

- `meridian.git.autofetch` — Auto-fetch on open (boolean, default: false)
- `meridian.hygiene.enabled` — Enable scans and analytics (boolean, default: true)
- `meridian.hygiene.prune.minAgeDays` — Minimum age for log files (number, default: 7)
- `meridian.hygiene.prune.maxSizeMB` — Maximum file size before flagging (number, default: 10)
- `meridian.hygiene.prune.minLineCount` — Minimum line count to consider "dead code" (number, default: 50)
- `meridian.log.level` — Logger verbosity: debug, info, warn, error (default: info)

---

## Output & Results

Most commands surface results via:
- **Output Channel** (`Meridian`) — logs, analytics prose, PR descriptions, reviews
- **Notifications** — success/error toasts with action links
- **Clipboard** — selected outputs (PR descriptions, reviews, briefings) auto-copy for pasting
- **Webview Panels** — analytics dashboards (Git, Hygiene) with full-screen charts and tables

---

## Extensibility

Domains, handlers, and middleware are designed for extension:
- Add custom commands by implementing a new domain and handler
- Chain middleware for custom auth, rate-limiting, or observability
- Define custom workflows in `.vscode/workflows/*.json`
- Create automation agents in `.vscode/agents/*.json` that wrap Meridian capabilities
- Export LM tools for autonomous Copilot workflows

See [ARCHITECTURE.md](./ARCHITECTURE.md) for extension points and patterns.
