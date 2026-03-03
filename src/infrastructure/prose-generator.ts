/**
 * Prose Generator — reusable primitive for `<context> → analyze → synthesize prose`.
 * All prose-generating features (PR description, PR review, session briefing, etc.)
 * share this pipeline. Uses VS Code Language Model API via model-selector.
 */

import * as vscode from "vscode";
import { selectModel, ModelDomain } from "./model-selector";
import { Result, success, failure } from "../types";

export interface ProseRequest {
  domain: ModelDomain;
  systemPrompt: string;
  data: Record<string, unknown>;
  formatData?: (data: Record<string, unknown>) => string;
}

export async function generateProse(request: ProseRequest): Promise<Result<string>> {
  try {
    const model = await selectModel(request.domain);
    if (!model) {
      return failure({
        code: "MODEL_UNAVAILABLE",
        message: "No language model available. Ensure GitHub Copilot is enabled.",
        context: "generateProse",
      });
    }

    const dataStr = request.formatData
      ? request.formatData(request.data)
      : JSON.stringify(request.data, null, 2);

    const messages = [
      vscode.LanguageModelChatMessage.User(`${request.systemPrompt}\n\n---\n\n${dataStr}`),
    ];

    const cts = new vscode.CancellationTokenSource();
    const response = await model.sendRequest(messages, {}, cts.token);

    let text = "";
    for await (const fragment of response.text) {
      text += fragment;
    }

    return success(text.trim());
  } catch (err) {
    return failure({
      code: "PROSE_GENERATION_ERROR",
      message: `Prose generation failed: ${err instanceof Error ? err.message : String(err)}`,
      context: "generateProse",
    });
  }
}

export async function streamProse(
  request: ProseRequest,
  sink: (fragment: string) => void
): Promise<Result<string>> {
  try {
    const model = await selectModel(request.domain);
    if (!model) {
      return failure({
        code: "MODEL_UNAVAILABLE",
        message: "No language model available. Ensure GitHub Copilot is enabled.",
        context: "streamProse",
      });
    }

    const dataStr = request.formatData
      ? request.formatData(request.data)
      : JSON.stringify(request.data, null, 2);

    const messages = [
      vscode.LanguageModelChatMessage.User(`${request.systemPrompt}\n\n---\n\n${dataStr}`),
    ];

    const cts = new vscode.CancellationTokenSource();
    const response = await model.sendRequest(messages, {}, cts.token);

    let text = "";
    for await (const fragment of response.text) {
      text += fragment;
      sink(fragment);
    }

    return success(text.trim());
  } catch (err) {
    return failure({
      code: "PROSE_GENERATION_ERROR",
      message: `Prose generation failed: ${err instanceof Error ? err.message : String(err)}`,
      context: "streamProse",
    });
  }
}
