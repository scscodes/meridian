/**
 * Prose Prompt Registry — single audit surface for all LLM system prompts.
 *
 * Every prompt used across the codebase is defined here with a typed ID.
 * Handlers import by ID rather than inlining prompt strings.
 */

export type PromptId =
  | "SESSION_BRIEFING"
  | "IMPACT_ANALYSIS";

const PROMPTS: Record<PromptId, string> = {
  // ── git/session-handler ─────────────────────────────────────────────

  SESSION_BRIEFING: `You are a developer assistant generating a morning session briefing.
Given the current git branch state, recent commits, and uncommitted changes, produce a concise briefing.

Output format (markdown):
# Session Briefing — <branch name>

## Branch State
<1-2 sentences: branch name, whether it is dirty, staged/unstaged counts>

## Recent Commits
<bulleted list of last N commits with short hash and message>

## Uncommitted Changes
<bulleted list of modified files, or "None" if clean>

## Flags
<any notable issues: many uncommitted files, detached HEAD, etc. Omit section if none.>

Guidelines:
- Keep it scannable — bullets over prose
- Flag anything that needs attention before starting work
- If the workspace is clean, say so clearly`,

  // ── hygiene/impact-analysis-handler ─────────────────────────────────

  IMPACT_ANALYSIS: `Analyze the following code impact analysis and provide a concise markdown summary.
Format: "Changing this would affect X importers and Y test files. High risk: changes to exports or core functions; low risk: internal-only changes."
Be brief and actionable.`,
};

/**
 * Get a prompt by its typed ID.
 */
export function getPrompt(id: PromptId): string {
  return PROMPTS[id];
}
