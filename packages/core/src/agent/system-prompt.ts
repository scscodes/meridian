import type { AgentConfig } from './types.js';

const BASE_SYSTEM_PROMPT = [
  'You are AIDev, an AI-powered developer toolkit assistant.',
  'You help developers with code analysis, commit workflows, and change summarization.',
  '',
  'You have access to the following tools. Use them when they would help answer the user\'s question.',
  'For read-only analysis tools, invoke them directly.',
  'For destructive or modifying tools, explain what you plan to do and wait for confirmation.',
  '',
].join('\n');

/**
 * Build the complete system prompt for the agent loop.
 * Combines built-in instructions with tool descriptions and optional custom prompt.
 */
export function buildSystemPrompt(config: AgentConfig): string {
  const parts: string[] = [];

  // Custom prompt takes precedence if provided
  if (config.systemPrompt) {
    parts.push(config.systemPrompt);
    parts.push('');
  } else {
    parts.push(BASE_SYSTEM_PROMPT);
  }

  // Enumerate available tools
  if (config.availableTools.length > 0) {
    parts.push('Available tools:');
    for (const tool of config.availableTools) {
      parts.push(`- ${tool.name}: ${tool.description}`);
    }
    parts.push('');
  }

  parts.push('Constraints:');
  parts.push('- All destructive actions (commits, comment pruning) must be proposed for user approval.');
  parts.push('- Never auto-apply file modifications or git operations.');
  parts.push('- Be concise and technical. Prioritize clarity.');

  return parts.join('\n');
}
