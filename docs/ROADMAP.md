  Project Understanding — Architecture & Intent

  Meridian is a VS Code extension built on DDD + Aiogram-style command routing. The core idea is a general-purpose extension framework
  with:

  - A CommandRouter that dispatches typed commands through a middleware chain
  - Domain services (Git, Hygiene, Chat, Workflow, Agent) that register handlers at startup
  - A Result monad ({kind: "ok"|"err"}) for explicit error handling — no thrown exceptions in normal flow
  - Middleware (logging, audit) applied declaratively before handler dispatch
  - Workflow engine that executes JSON-defined step sequences
  - Agent registry that discovers local agent definitions from .vscode/agents/

  ---
  Feature State Analysis

  ┌─────────────────────────────────┬───────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────┐
  │             Feature             │        Status         │                                            Notes                                            │
  ├─────────────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ CommandRouter + Middleware      │ Solid                 │ Fully implemented: registration, dispatch, validation, teardown, middleware chain           │
  ├─────────────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Result monad / error handling   │ Solid                 │ Comprehensive. Centralized error codes in error-codes.ts + constants.ts                     │
  ├─────────────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Git domain — status/pull/commit │ Functional (mock)     │ Handlers are complete but use MockGitProvider — no real git CLI execution                   │
  ├─────────────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Git domain — smartCommit        │ Functional (mock)     │ Full pipeline: ChangeGrouper, CommitMessageSuggester, BatchCommitter with rollback          │
  ├─────────────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Git domain — analyzeInbound     │ Functional (mock)     │ InboundAnalyzer: fetch, diff, conflict detection, diff link generation                      │
  ├─────────────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Git domain — analytics          │ Functional (real git) │ GitAnalyzer calls actual git log via execSync. Webview HTML/JS/CSS exist                    │
  ├─────────────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Hygiene domain                  │ Stub                  │ Handlers registered but workspace scanning uses mock provider                               │
  ├─────────────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Chat domain                     │ Stub                  │ Context gathering + delegation stubs exist                                                  │
  ├─────────────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Workflow domain                 │ Functional            │ WorkflowEngine with step execution, variable interpolation, conditional branching           │
  ├─────────────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Agent domain                    │ Functional            │ AgentRegistry with JSON loading, capability/trigger queries                                 │
  ├─────────────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Telemetry                       │ Implemented           │ TelemetryTracker + InMemoryTelemetrySink / ConsoleTelemetrySink. Not wired into main.ts yet │
  ├─────────────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Config                          │ Implemented           │ Typed config with VS Code settings contribution points                                      │
  ├─────────────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Constants                       │ Solid                 │ Centralized in constants.ts — command names, thresholds, cache settings, performance bounds │
  ├─────────────────────────────────┼───────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Tests                           │ Partial               │ 10 test files covering router, result monad, workflow engine, git subsystems                │
  └─────────────────────────────────┴───────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────┘

  ---
  UI/UX Surface Analysis

  This is the area you flagged as potentially lacking — and that assessment is accurate. Here's what exists vs. what's missing:

  What Exists

  1. Command palette commands (10 registered in package.json contributes.commands) — this is the primary user touchpoint today
  2. VS Code settings (4 declared: git.autofetch, hygiene.enabled, hygiene.scanInterval, log.level)
  3. Git Analytics webview — HTML/CSS/JS in src/domains/git/analytics-ui/ with Chart.js visualization (commit frequency, churn, author contributions, volatility
  scatter). The AnalyticsWebviewProvider exists in infrastructure/webview-provider.ts

  What's Missing / Not Connected

  1. No sidebar/panel registration — no views or viewsContainers in package.json contributes. There's no persistent UI presence (tree views, panels, etc.)
  2. Webview provider not wired — AnalyticsWebviewProvider (src/infrastructure/webview-provider.ts) is a mock that doesn't implement vscode.WebviewViewProvider.
     It's not registered in main.ts activation. Needs:
     - Implement vscode.WebviewViewProvider interface (resolveWebviewView method)
     - Register in main.ts via context.subscriptions.push(vscode.window.registerWebviewViewProvider(...))
     - Add views contribution point in package.json (e.g., "views.meridian": [{ "id": "meridian.analytics", ... }])
  3. No real VS Code command wiring — main.ts:activate() creates the router but the vscode.commands.registerCommand() calls are commented out (lines 253-261).
     Needs:
     - Replace commented block with actual registration for all 10 commands in package.json
     - Import vscode module (uncomment line 7)
     - Modify signature to accept vscode.ExtensionContext
     - Wrap result dispatch with error handling + vscode.window notifications
     - [WARN] VS Code command IDs in package.json are prefixed (e.g., "meridian.git.status") while internal router command names are bare (e.g., "git.status"); wiring requires an explicit mapping layer between external command IDs and internal CommandName values rather than assuming string equality.
     - [WARN] The commented example in main.ts registers "git.status" as the VS Code command ID, which does not correspond to any contributes.commands entry and would never be invoked as-is; real wiring must register the prefixed IDs from package.json.
     - [WARN] There is currently no getCommandContext() implementation to construct a CommandContext from VS Code APIs; adding real command wiring also needs a helper (or equivalent) that fills extensionPath, workspaceFolders, and activeFilePath from vscode.ExtensionContext / vscode.workspace / vscode.window.
     - [WARN] Changing activate to accept vscode.ExtensionContext is not just a type tweak — the CommandContext model still expects an extensionPath string and workspace metadata, so activation code must derive and pass these from the VS Code context instead of ignoring them.
  4. No user-facing output — commands dispatch and return Result objects, but there's no vscode.window.showInformationMessage, no Output Channel, no notification.
     Results go nowhere a user can see. Needs:
     - Create vscode.OutputChannel in activate() and attach to context.subscriptions
     - Add helper: resultToUserMessage() that converts Result → notification (info/warn/error)
     - Call vscode.window.showInformationMessage / showErrorMessage in command handlers
  5. SmartCommit interactivity is stubbed — lines 206-217 in src/domains/git/handlers.ts: the "present to user for approval" step just auto-approves; there's no QuickPick,
     InputBox, or webview dialog. Needs:
     - Implement vscode.window.showQuickPick() to display groups with suggested messages
     - Allow user to edit/approve each message or skip group
     - Return filtered groups for batch commit
  6. No menus, keybindings, or when-clauses — commands exist in palette but no context menu entries, no keyboard shortcuts, no conditional visibility.
     Needs in package.json:
     - "menus": { "commandPalette": [...], "explorer/context": [...] } — add git/hygiene commands to file explorer context
     - "keybindings": [...] — define shortcuts (e.g., "Ctrl+Shift+G" for git.smartCommit)
     - "when" clause conditions (e.g., "git.status" only when gitRepository context)
  7. Workflow/Agent management has no UI — listed in ARCHITECTURE.md "Next Steps" as needing sidebar UI.
  8. Chat domain — VS Code Chat API / Copilot integration not wired. Needs:
     - Register as chat participant: vscode.chat.createChatParticipant() if targeting GitHub Copilot Chat
     - OR implement language model access: vscode.lm.selectChatModels() for built-in LM
     - Map chat.context → chat session setup; chat.delegate → participant tools/functions
     - Add "chatParticipants" contribution point in package.json if using chat participant API

  Summary

  The backend/domain architecture is well-structured and fairly complete. The gap is the "last mile" to the user — the extension currently has no way to surface its
  functionality visually in VS Code beyond command palette entries, and even those aren't actually wired to the real VS Code API yet.

