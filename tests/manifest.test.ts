/**
 * Manifest Consistency Tests
 *
 * Cross-checks the TypeScript command/tool sources against package.json declarations.
 * Catches drift between the two authoritative layers:
 *   - COMMAND_MAP (presentation layer)  → contributes.commands + menus.commandPalette
 *   - COMMAND_CATALOG (infrastructure)  → contributes.languageModelTools
 *
 * Whitelisted command classes (not in COMMAND_MAP, but valid in the manifest):
 *   SPECIALIZED_COMMANDS — dedicated registrations per ADR 005 (custom UI/param sourcing)
 *   INFRASTRUCTURE_COMMANDS — view lifecycle commands (refresh, statusBar); no routing
 */

import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";

// command-registry.ts imports vscode at module level; provide a stub so it resolves.
vi.mock("vscode", () => ({}));

import { COMMAND_MAP } from "../src/presentation/command-registry";
import { COMMAND_CATALOG, LM_TOOL_DEFS } from "../src/infrastructure/command-catalog";

// ── Whitelists ────────────────────────────────────────────────────────────────

/** Registered in specialized-commands.ts or main.ts (ADR 005). Not in COMMAND_MAP. */
const SPECIALIZED_COMMANDS = new Set([
  "meridian.workflow.run",
  "meridian.hygiene.deleteFile",
  "meridian.hygiene.ignoreFile",
  "meridian.hygiene.reviewFile",
  "meridian.hygiene.impactAnalysis", // ADR 005: active-file fallback + InputBox prompt
  "meridian.git.resolveConflicts",   // ADR 005: tree expansion hooks
  "meridian.agent.run",
]);

/** View lifecycle commands. No routing, no palette exposure. */
const INFRASTRUCTURE_COMMANDS = new Set([
  "meridian.git.refresh",
  "meridian.hygiene.refresh",
  "meridian.workflow.refresh",
  "meridian.agent.refresh",
  "meridian.statusBar.clicked",
  "meridian.refreshAll",
]);

// ── Load package.json ─────────────────────────────────────────────────────────

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf-8")
);

const manifestCommands = pkg.contributes.commands as { command: string; title: string; icon?: string }[];
const manifestCommandIds = new Set(manifestCommands.map(c => c.command));
const manifestCommandMap = new Map(manifestCommands.map(c => [c.command, c]));

const paletteIds = new Set(
  (pkg.contributes.menus.commandPalette as { command: string }[]).map(e => e.command)
);

const lmToolNames = new Set(
  (pkg.contributes.languageModelTools as { name: string }[]).map(t => t.name)
);

const commandMapIds = new Set(COMMAND_MAP.map(e => e.vsCodeId));
const catalogToolNames = new Set(LM_TOOL_DEFS.map(t => t.name));

// ── Suite A: VS Code commands surface ─────────────────────────────────────────

describe("Manifest — VS Code commands surface", () => {

  it("every COMMAND_MAP entry with a title exists in contributes.commands", () => {
    const missing: string[] = [];
    for (const entry of COMMAND_MAP) {
      if (!entry.title) continue;
      if (!manifestCommandIds.has(entry.vsCodeId)) {
        missing.push(`${entry.vsCodeId} ("${entry.title}")`);
      }
    }
    expect(missing, `Missing from contributes.commands:\n  ${missing.join("\n  ")}`).toEqual([]);
  });

  it("every COMMAND_MAP entry with a title has matching title in contributes.commands", () => {
    const mismatches: string[] = [];
    for (const entry of COMMAND_MAP) {
      if (!entry.title) continue;
      const manifest = manifestCommandMap.get(entry.vsCodeId);
      if (!manifest) continue; // caught by previous test
      if (manifest.title !== entry.title) {
        mismatches.push(`${entry.vsCodeId}: COMMAND_MAP="${entry.title}" vs manifest="${manifest.title}"`);
      }
    }
    expect(mismatches, `Title mismatches:\n  ${mismatches.join("\n  ")}`).toEqual([]);
  });

  it("every COMMAND_MAP entry with an icon has matching icon in contributes.commands", () => {
    const mismatches: string[] = [];
    for (const entry of COMMAND_MAP) {
      if (!entry.icon || !entry.title) continue;
      const manifest = manifestCommandMap.get(entry.vsCodeId);
      if (!manifest) continue;
      if (manifest.icon !== entry.icon) {
        mismatches.push(`${entry.vsCodeId}: COMMAND_MAP="${entry.icon}" vs manifest="${manifest.icon}"`);
      }
    }
    expect(mismatches, `Icon mismatches:\n  ${mismatches.join("\n  ")}`).toEqual([]);
  });

  it("every contributes.commands entry is accounted for (COMMAND_MAP or whitelist)", () => {
    const orphans: string[] = [];
    for (const { command } of manifestCommands) {
      if (!commandMapIds.has(command) && !SPECIALIZED_COMMANDS.has(command) && !INFRASTRUCTURE_COMMANDS.has(command)) {
        orphans.push(command);
      }
    }
    expect(orphans, `Orphaned contributes.commands (not in COMMAND_MAP or whitelists):\n  ${orphans.join("\n  ")}`).toEqual([]);
  });

  it("every COMMAND_MAP entry with showInPalette exists in contributes.menus.commandPalette", () => {
    const missing: string[] = [];
    for (const entry of COMMAND_MAP) {
      if (!entry.showInPalette) continue;
      if (!paletteIds.has(entry.vsCodeId)) {
        missing.push(entry.vsCodeId);
      }
    }
    expect(missing, `Missing from commandPalette:\n  ${missing.join("\n  ")}`).toEqual([]);
  });

  it("no infrastructure command appears in commandPalette", () => {
    const unexpected: string[] = [];
    for (const id of paletteIds) {
      if (INFRASTRUCTURE_COMMANDS.has(id)) {
        unexpected.push(id);
      }
    }
    expect(unexpected, `Infrastructure commands (view lifecycle) must not be in commandPalette:\n  ${unexpected.join("\n  ")}`).toEqual([]);
  });

});

// ── Suite B: LM tools surface ─────────────────────────────────────────────────

describe("Manifest — LM tools surface", () => {

  it("every COMMAND_CATALOG entry with lmToolName exists in languageModelTools", () => {
    const missing: string[] = [];
    for (const entry of COMMAND_CATALOG) {
      if (!entry.lmToolName) continue;
      if (!lmToolNames.has(entry.lmToolName)) {
        missing.push(`${entry.lmToolName} (from ${entry.commandName})`);
      }
    }
    expect(missing, `Missing from languageModelTools:\n  ${missing.join("\n  ")}`).toEqual([]);
  });

  it("every languageModelTools entry has a corresponding lmToolName in COMMAND_CATALOG", () => {
    const orphans: string[] = [];
    for (const name of lmToolNames) {
      if (!catalogToolNames.has(name)) {
        orphans.push(name);
      }
    }
    expect(orphans, `Orphaned languageModelTools (not in COMMAND_CATALOG):\n  ${orphans.join("\n  ")}`).toEqual([]);
  });

});
