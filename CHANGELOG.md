# [2.7.0](https://github.com/scscodes/meridian/compare/v2.6.0...v2.7.0) (2026-05-26)


### Features

* session briefing UI/UX polish pass ([e8d7336](https://github.com/scscodes/meridian/commit/e8d733650e97e3e5958657050dc04dd37319b5e1))

# [2.6.0](https://github.com/scscodes/meridian/compare/v2.5.0...v2.6.0) (2026-05-21)


### Features

* default report-export save dialog to .meridian/artifacts/ ([b6e4d1f](https://github.com/scscodes/meridian/commit/b6e4d1f527d8d6155d9a7f040877fc3bf9a6e097))
* quick-save + Save-as for webview reports to .meridian/artifacts/ ([0c04957](https://github.com/scscodes/meridian/commit/0c049576f5efb70825ee6ce8910418a883c660f8))

# [2.5.0](https://github.com/scscodes/meridian/compare/v2.4.0...v2.5.0) (2026-05-20)


### Bug Fixes

* mock fs.renameSync in dotdir migration tests ([6186fa8](https://github.com/scscodes/meridian/commit/6186fa8911192f83bf098996fbfb82b0f8e00db6))


### Features

* auto-migrate legacy .meridianignore on activation ([daa043a](https://github.com/scscodes/meridian/commit/daa043acc248633860abb70ad5f80c5833832d70))
* consolidate settings reads, purge dead Config class, dedupe ignore reader ([51b4c7d](https://github.com/scscodes/meridian/commit/51b4c7d4033f99364d2004c02d3a7d08aeb407d0))
* **settings:** .meridian/settings.json overrides VS Code meridian.* keys ([995dd5c](https://github.com/scscodes/meridian/commit/995dd5ca43edb8d142ad52990865e49eaa6417ae))

# [2.4.0](https://github.com/scscodes/meridian/compare/v2.3.0...v2.4.0) (2026-05-20)


### Bug Fixes

* explicit Meridian settings cog on view section headings ([e6d1126](https://github.com/scscodes/meridian/commit/e6d112612fda0623e0f986c10f301b086b145d70))


### Features

* right-click "Ignore file / folder" in webview reports ([2548664](https://github.com/scscodes/meridian/commit/254866416779a72ac11c80fe45ac8d17e2cf3076))

# [2.3.0](https://github.com/scscodes/meridian/compare/v2.2.0...v2.3.0) (2026-05-19)


### Features

* **ui:** normalize webview-report popup parity (ADR 006 Rule 5) ([91de6cb](https://github.com/scscodes/meridian/commit/91de6cbbf94c10cc226b6d007d53d1066fa99da5))
* **ui:** unify webview-report labels via REPORT_LABELS single-source ([bced871](https://github.com/scscodes/meridian/commit/bced871e498df8a57715290da53752e77e59f2a9))

# [2.2.0](https://github.com/scscodes/meridian/compare/v2.1.0...v2.2.0) (2026-05-19)


### Features

* add pending-change risk to session briefing ([ebf56e1](https://github.com/scscodes/meridian/commit/ebf56e1fecb299af5c8b5582721eb243eceabd8c))
* **webviews:** risk-hotspot scatter + commit-frequency sparkline (Phase 1a) ([31db003](https://github.com/scscodes/meridian/commit/31db003353e3c40dbd58e96ac6026ce69a17af91))

# [2.1.0](https://github.com/scscodes/meridian/compare/v2.0.1...v2.1.0) (2026-05-19)


### Features

* normalize Reports sidebar section ([1cf55c1](https://github.com/scscodes/meridian/commit/1cf55c16d337cc9f2d94cca300b829ad10006b70))
* promote webview reports to Panel Reports sidebar view ([5da796d](https://github.com/scscodes/meridian/commit/5da796d8289cfcbe5cd117794389d45aa8129aa4))
* **session-briefing:** retain high-ROI analytics/hygiene insight; hoist peripheral fetches; extract constants ([f824c6c](https://github.com/scscodes/meridian/commit/f824c6c04b9b02921a527b91754996b09d7f61bb)), closes [hi#ROI](https://github.com/hi/issues/ROI) [#4](https://github.com/scscodes/meridian/issues/4)
* surface retained insight in briefing UI+CSV ([1d3232a](https://github.com/scscodes/meridian/commit/1d3232ae531a31e348462dbac570e49e816c7138))

## [2.0.1](https://github.com/scscodes/meridian/compare/v2.0.0...v2.0.1) (2026-05-18)


### Bug Fixes

* use valid VS Marketplace categories to unblock release publish ([7830209](https://github.com/scscodes/meridian/commit/783020934937bfabfb8b120581b837cf47f50646))

# [2.0.0](https://github.com/scscodes/meridian/compare/v1.8.3...v2.0.0) (2026-05-18)


* feat!: re-anchor to computed-insight instrument panel (2.0) ([177399d](https://github.com/scscodes/meridian/commit/177399dbf060479e081004b2a9c6a9f82c917839))


### Bug Fixes

* degrade session briefing & impact analysis to deterministic output when no model ([d858d20](https://github.com/scscodes/meridian/commit/d858d20c39399fe9e7f12638ec9981c5385909b7))


### BREAKING CHANGES

* Removed commands git.smartCommit, git.generatePR,
git.reviewPR, git.commentPR, git.resolveConflicts, git.analyzeInbound,
hygiene.reviewFile, all workflow.* and agent.* commands, all chat.*
commands; removed the @meridian chat participant and all 21 language
model tools; removed the Workflows and Agents sidebar views; removed
config keys meridian.model.chat, meridian.chat.model,
meridian.chat.contextLines, meridian.startup.enableChatSurface.
ADR 003, 007, 010 superseded; 004, 006, 008-lifecycle, 009, 011 revised.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

## [1.8.3](https://github.com/scscodes/meridian/compare/v1.8.2...v1.8.3) (2026-04-26)


### Bug Fixes

* **chat:** align in-app help and docs with declared slash commands ([d3171ad](https://github.com/scscodes/meridian/commit/d3171ad2be0e6b50aa1ead3b06a702c4debe649b))

## [1.8.2](https://github.com/scscodes/meridian/compare/v1.8.1...v1.8.2) (2026-04-24)


### Bug Fixes

* **readme:** restore marketplace screenshots ([886521f](https://github.com/scscodes/meridian/commit/886521fa200a3c8d9b098db6fc90965401fe9838))

## [1.8.1](https://github.com/scscodes/meridian/compare/v1.8.0...v1.8.1) (2026-04-24)


### Bug Fixes

* **distribution:** announce Open VSX support ([6d9b7f7](https://github.com/scscodes/meridian/commit/6d9b7f79c355199cba048ec1048193e2f4396ef6))

# [1.8.0](https://github.com/scscodes/meridian/compare/v1.7.0...v1.8.0) (2026-04-20)


### Features

* add run event log (Foundation [#1](https://github.com/scscodes/meridian/issues/1), ADR 009) ([ba8dc0e](https://github.com/scscodes/meridian/commit/ba8dc0efb2619cb36958ab6dc65a05f5e808b382))
* LM tool result envelope (Foundation [#3](https://github.com/scscodes/meridian/issues/3), ADR 010) ([96ced61](https://github.com/scscodes/meridian/commit/96ced6159ceb0339967d04e5ee60d4f55df6de0c))
* router dispatch lifecycle events — pre-execution signaling hook ([4e587e0](https://github.com/scscodes/meridian/commit/4e587e083f7d2c58270606711e9c0068f86c65d5)), closes [#2](https://github.com/scscodes/meridian/issues/2)
* session briefing data aggregator (Foundation [#4](https://github.com/scscodes/meridian/issues/4), ADR 011) ([31de040](https://github.com/scscodes/meridian/commit/31de04057d11eb5963db285f5b3d1c30271ad26a))

# [1.7.0](https://github.com/scscodes/meridian/compare/v1.6.0...v1.7.0) (2026-04-17)


### Features

* chat integration polish — LM tool discoverability + followup chips + 3 slashes ([c462f79](https://github.com/scscodes/meridian/commit/c462f7914163baffc00efdad5b6aff3b1979fd71)), closes [#-reference](https://github.com/scscodes/meridian/issues/-reference)

# [1.6.0](https://github.com/scscodes/meridian/compare/v1.5.0...v1.6.0) (2026-04-08)


### Features

* **chat:** add NL → workflow routing via chat.delegate classifier ([114039d](https://github.com/scscodes/meridian/commit/114039d6d1713c7eef03ca7c508586ee78ae676f))

# [1.5.0](https://github.com/scscodes/meridian/compare/v1.4.0...v1.5.0) (2026-04-07)


### Features

* **skill:** add built-in skill domain with session overview, PR ready, and pre-merge recipes ([693a084](https://github.com/scscodes/meridian/commit/693a0849348e6f3d36d78aa62b9d84614e2cdac3))

# [1.4.0](https://github.com/scscodes/meridian/compare/v1.3.0...v1.4.0) (2026-04-01)


### Features

* session briefing webview, smart commit LLM enhancement, remove out/ from tracking ([cffcfbc](https://github.com/scscodes/meridian/commit/cffcfbc08eb4d97123579749389fd61f357cfb73))

# [1.3.0](https://github.com/scscodes/meridian/compare/v1.2.1...v1.3.0) (2026-03-31)


### Features

* catalog-anchored manifest — normalized command registry ([2293ed3](https://github.com/scscodes/meridian/commit/2293ed3293238debd06997baf2cd7a64f57aa18a))

## [1.2.1](https://github.com/scscodes/meridian/compare/v1.2.0...v1.2.1) (2026-03-30)


### Bug Fixes

* git analytics doughnut chart overflow and rename label corruption ([b73c668](https://github.com/scscodes/meridian/commit/b73c66899de3b53b6e45b0b98560e693cced9247))

# [1.2.0](https://github.com/scscodes/meridian/compare/v1.1.0...v1.2.0) (2026-03-25)


### Features

* report discoverability and analytics export standardization ([832ef7b](https://github.com/scscodes/meridian/commit/832ef7bb8530eef5ba0210ca783baa0901337706))
* workflow retries, timeouts, and conditional step routing ([1038916](https://github.com/scscodes/meridian/commit/1038916468b248f39578da6fcce40863b8607161))

# [1.1.0](https://github.com/scscodes/meridian/compare/v1.0.0...v1.1.0) (2026-03-15)


### Bug Fixes

* content generation edge cases — LLM fallback transparency, diff truncation, PR title, dead code errors, git log delimiter ([8d4c163](https://github.com/scscodes/meridian/commit/8d4c163e39e9469911091bc0bc714555ffc23d2e))


### Features

* chat formatters, hygiene stability, agent rendering completeness ([6796460](https://github.com/scscodes/meridian/commit/679646064e32621f9f3b2c5a246e6e56550684b1))
* refine git and agent UX and config ([05f3323](https://github.com/scscodes/meridian/commit/05f33239c301c6ae1b8ce398882e07f8ae6a9b49))
* UI/UX sprint — progress indicators, error compliance, NL classify-then-dispatch ([ad95a2b](https://github.com/scscodes/meridian/commit/ad95a2b3c48943d394d5fcc71aef8a9108ad8903))
* unified UI/UX rendering strategy — ADR 006/007 + workflow.run pilot ([375d09d](https://github.com/scscodes/meridian/commit/375d09de9e4c4603f9922cd67694f0a1cc321a2f))

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
