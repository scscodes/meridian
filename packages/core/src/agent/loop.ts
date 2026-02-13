import type { IModelProvider, ChatMessage, ToolResult, ModelResponse } from '../types/index.js';
import { getToolByCommand } from '../tools/index.js';
import type { AgentConfig, AgentAction } from './types.js';
import { buildSystemPrompt } from './system-prompt.js';

/** Minimum remaining token budget to allow another request */
const MIN_TOKEN_BUDGET_THRESHOLD = 100;

/**
 * Run the agentic multi-turn loop.
 *
 * This is an async generator that yields AgentAction values. The host
 * (e.g. VSCode chat participant) drives the loop:
 *
 * 1. Call runAgentLoop() to get the generator
 * 2. Call next() to get the first action
 * 3. If action is tool_call or confirmation_required, execute/confirm
 *    and call next(toolResult) to feed the result back
 * 4. If action is response or error, the loop is done
 *
 * The generator pattern keeps the loop pure — it doesn't execute tools
 * or interact with the IDE directly.
 */
export async function* runAgentLoop(
  provider: IModelProvider,
  config: AgentConfig,
  history: ChatMessage[],
  userMessage: string,
): AsyncGenerator<AgentAction, void, ToolResult | undefined> {
  const messages: ChatMessage[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let turnsRemaining = config.maxTurns;

  // Build system prompt
  const systemPrompt = buildSystemPrompt(config);
  messages.push({ role: 'system', content: systemPrompt });

  // Replay conversation history
  for (const msg of history) {
    messages.push(msg);
  }

  // Add the new user message
  messages.push({ role: 'user', content: userMessage });

  // Agent loop — iterate until text response or limits hit
  while (turnsRemaining > 0) {
    // Check token budget
    const tokensUsed = totalInputTokens + totalOutputTokens;
    if (tokensUsed >= config.maxTokenBudget - MIN_TOKEN_BUDGET_THRESHOLD) {
      yield {
        type: 'error',
        message: `Token budget exhausted (${String(tokensUsed)} / ${String(config.maxTokenBudget)} tokens used).`,
      };
      return;
    }

    // Send request to model
    let response: ModelResponse;
    try {
      response = await provider.sendRequest({
        role: 'chat',
        messages,
        tools: config.availableTools.length > 0 ? config.availableTools : undefined,
      });
    } catch (err: unknown) {
      yield {
        type: 'error',
        message: `Model request failed: ${err instanceof Error ? err.message : String(err)}`,
      };
      return;
    }

    // Track token usage
    if (response.usage) {
      totalInputTokens += response.usage.inputTokens;
      totalOutputTokens += response.usage.outputTokens;
    }

    // No tool calls — final text response
    if (!response.toolCalls || response.toolCalls.length === 0) {
      yield {
        type: 'response',
        content: response.content,
        usage: { totalInputTokens, totalOutputTokens },
      };
      return;
    }

    // Has tool calls — record the assistant message with tool calls
    messages.push({
      role: 'assistant',
      content: response.content,
      toolCalls: response.toolCalls,
    });

    // Process each tool call
    for (const toolCall of response.toolCalls) {
      // Look up tool in registry to determine invocation mode
      const entry = getToolByCommand(toolCall.name);

      if (!entry) {
        // Unknown tool — feed error back to model
        const availableNames = config.availableTools.map((t) => t.name).join(', ');
        messages.push({
          role: 'tool_result',
          content: `Unknown tool: "${toolCall.name}". Available tools: ${availableNames}`,
          toolCallId: toolCall.id,
        });
        continue;
      }

      // Yield appropriate action based on invocation mode
      const action: AgentAction =
        entry.invocation === 'autonomous'
          ? {
              type: 'tool_call',
              toolId: entry.id,
              callId: toolCall.id,
              args: toolCall.arguments,
            }
          : {
              type: 'confirmation_required',
              toolId: entry.id,
              callId: toolCall.id,
              args: toolCall.arguments,
              description: `${entry.name}: ${entry.description}`,
            };

      // Yield the action and wait for the host to provide the result
      const toolResult: ToolResult | undefined = yield action;

      if (toolResult) {
        messages.push({
          role: 'tool_result',
          content: toolResult.content,
          toolCallId: toolResult.toolCallId,
        });
      } else {
        // Host didn't provide a result (e.g. user denied)
        messages.push({
          role: 'tool_result',
          content: 'Tool execution was skipped or denied by the user.',
          toolCallId: toolCall.id,
        });
      }
    }

    turnsRemaining--;
  }

  // Turn limit reached
  yield {
    type: 'error',
    message: `Agent loop reached maximum turns (${String(config.maxTurns)}). Stopping to prevent runaway execution.`,
  };
}
