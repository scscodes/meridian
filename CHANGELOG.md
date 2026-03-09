# 1.0.0 (2026-03-09)


### Bug Fixes

* add repository field to package.json for vsce image resolution ([4a6d831](https://github.com/scscodes/meridian/commit/4a6d831dd3e0d09ea716ea623c0c9be410ba8fe7))
* **analytics:** correct path filter bleed-through, trend direction, and UTC week bucketing ([c052aaa](https://github.com/scscodes/meridian/commit/c052aaa4e933d25460cbbef05edcb0568133a543))
* **analytics:** patch 4 runtime bugs in git analytics + improve error observability ([c227a32](https://github.com/scscodes/meridian/commit/c227a32719c3d479045045751a4957e408071078))
* bundle with esbuild to include runtime deps in VSIX (0.0.3) ([81f0c8b](https://github.com/scscodes/meridian/commit/81f0c8b1031abcd1e26d564a6bf7d8683b52e099))
* eliminate inline error code strings + add config test coverage ([802b498](https://github.com/scscodes/meridian/commit/802b498b71701053d8504a16df8b15bf7be5948f))
* **git analytics:** shrink donut charts to 220px height ([27b346e](https://github.com/scscodes/meridian/commit/27b346e6647de304a37f6405e9fde94178a278d4))
* iteration 1 — hygiene scheduling, workspace logging, any types, error-codes ([3fc1506](https://github.com/scscodes/meridian/commit/3fc1506d1934cbd1bac13bee99c7edf8b5e578d1))
* package.json publish-readiness — LM tools, engine version, path typo ([52e534d](https://github.com/scscodes/meridian/commit/52e534d6bc7d2c54920d81aac04b188cf3fd3505))
* workflow/agent result alignment — error messages, agent.execute formatter ([bcc2dec](https://github.com/scscodes/meridian/commit/bcc2decc72dc5f196b453061c6582f89bf940f44)), closes [#6](https://github.com/scscodes/meridian/issues/6)


### Features

* accumulated UI/UX phase changes, prose pipeline wiring, and bundled workflows ([1d41735](https://github.com/scscodes/meridian/commit/1d4173581b167e826d46271f4a5700988b97a4a5))
* add agentic loop, branch diff, conflict resolver, and enhanced auto-commit ([3be7aba](https://github.com/scscodes/meridian/commit/3be7aba70cb71841992f8d8bc284edaacd3a43ce))
* add dead code detection, analyzer, added in analytics UI. tweaks to git analytics UI for size. ([5e81656](https://github.com/scscodes/meridian/commit/5e816561ce5f0a473f9e15931e4986c99851e435))
* add keybindings, explorer context menus, command palette when-clauses, and implement analytics path filtering ([17c78ee](https://github.com/scscodes/meridian/commit/17c78ee478b1034e82682f32c03a1f3ea6136a1c))
* add marketplace icon, remove private flag, exclude source JPEG ([78253ca](https://github.com/scscodes/meridian/commit/78253cad9fa7f55eba2562449cee7ed847c7748b))
* add PR review tool and redesign sidebar with inline status and context menu ([66e81a2](https://github.com/scscodes/meridian/commit/66e81a2d66d7b774613d2de32526a721c3b66792))
* Add workflow routing and PR review pipeline ([c133c9f](https://github.com/scscodes/meridian/commit/c133c9fa69454acd55abcc1bbdfe4707bcbe6818))
* base tool class, model provider implementations ([f799ec8](https://github.com/scscodes/meridian/commit/f799ec8dfe152f9fe5b473bb0a0f9fc36600cfa4))
* **chat:** route NL through chat.delegate, eliminate dual classifier ([bd0af03](https://github.com/scscodes/meridian/commit/bd0af030cad05c0b033f69578abf3253a0a0c850))
* code impact analysis and agent execution foundations ([c7db182](https://github.com/scscodes/meridian/commit/c7db1826fc80458271b082a8a03e1f91ced59b99))
* drop keyword map, add /impact slash command, consolidate NL routing ([e522a0f](https://github.com/scscodes/meridian/commit/e522a0fd9cfc20d5a86e45b8a6928fca3906c4bc))
* end-to-end tool execution pipeline with results UI ([531909e](https://github.com/scscodes/meridian/commit/531909ea3e55044fb4bd74bad0fbac738066ecc1))
* expand LM tools — add 7 missing tool registrations ([4ceda3c](https://github.com/scscodes/meridian/commit/4ceda3c38be42d4fae62c112bc6934fc4ea8c2bd))
* **git:** add prose pipeline primitive and 4 git prose consumers ([4406889](https://github.com/scscodes/meridian/commit/44068893095cea1efa26d6d5998e0652c1f229a7))
* **git:** add SmartCommit approval UI with QuickPick-based group selection ([5c1ff59](https://github.com/scscodes/meridian/commit/5c1ff596beeadbe13732eaf335548f1b5bc896e2))
* implement CommitTool, TldrTool, CommentsTool ([49ffebc](https://github.com/scscodes/meridian/commit/49ffebc470a8abff157ced3be6f44ac37c9ee632))
* implement DeadCodeTool and LintTool ([8d696c9](https://github.com/scscodes/meridian/commit/8d696c90193e0b4fd911e019f343dfa18b067448))
* implement DeadCodeTool and LintTool ([a51d79b](https://github.com/scscodes/meridian/commit/a51d79ba29bfc1652274cafadd91c62763403cf2))
* implement telemetry foundation ([1ad973c](https://github.com/scscodes/meridian/commit/1ad973c90dcd9c03fdc2f6e840234868e3208486))
* parallel workflow execution for autonomous tool phase ([6e9498c](https://github.com/scscodes/meridian/commit/6e9498c7e4cb0f5bab18987902051b38ac6b53be))
* settings bridge, git operations layer, unit tests ([51eea41](https://github.com/scscodes/meridian/commit/51eea41174883e5b4138d08f3584b602a3977baa))
* surface workflow step results in output channel (0.0.4) ([ddd2ca4](https://github.com/scscodes/meridian/commit/ddd2ca42718c2abe5b3b1fdc42f7ccbdeffbeeb7))
* task decomposition and speculative pre-execution ([d8508aa](https://github.com/scscodes/meridian/commit/d8508aa132f3e3e12510c1cd318c39b306309f57))
* **tests:** iteration 3 — chat routing tests, LM tools tests, NL orchestration docs ([08002a0](https://github.com/scscodes/meridian/commit/08002a010d6c17111115b3013a3bfde6fc1a3587))
* UI/UX improvements and tool enhancements ([fa3ad39](https://github.com/scscodes/meridian/commit/fa3ad394d89939c443a44db80ffbd4a1c49e2699))

# Changelog

## [0.0.1] - 2026-03-04
### Added
- Git domain: status, pull, commit, smart commit, analytics, PR generation/review/comments, conflict resolution, session briefing
- Hygiene domain: scan, cleanup, impact analysis, analytics
- Workflow engine: JSON-defined workflows with conditional branching
- Agent framework: discovery and execution of local agents
- @meridian chat participant with 11 slash commands + NL classification
- 16 LM tools for Copilot agent mode
- 4 sidebar tree views (Git, Hygiene, Workflow, Agent)
- Status bar with real-time branch indicator
