/**
 * LM Tools — registers Meridian commands as VS Code Language Model Tools.
 *
 * Enables autonomous tool invocation by GitHub Copilot and the @meridian
 * chat participant. Each tool wraps a CommandRouter dispatch call and returns
 * a formatted text result the LLM can reason over.
 */

import * as vscode from "vscode";
import { CommandRouter } from "../router";
import { CommandContext } from "../types";
import { Logger } from "../infrastructure/logger";
import { formatResultMessage } from "../infrastructure/result-handler";
import { LM_TOOL_DEFS } from "../infrastructure/command-catalog";

export function registerMeridianTools(
  router: CommandRouter,
  ctx: CommandContext,
  logger: Logger
): vscode.Disposable[] {
  return LM_TOOL_DEFS.map(({ name, commandName }) =>
    vscode.lm.registerTool(name, {
      async invoke(
        options: vscode.LanguageModelToolInvocationOptions<Record<string, unknown>>,
        _token: vscode.CancellationToken
      ): Promise<vscode.LanguageModelToolResult> {
        const params = (options.input ?? {}) as Record<string, unknown>;
        logger.info(`LM tool invoked: ${name}`, "LMTools");

        const result = await router.dispatch({ name: commandName, params }, ctx);
        const { message } = formatResultMessage(commandName, result);

        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(message),
        ]);
      },
    })
  );
}
