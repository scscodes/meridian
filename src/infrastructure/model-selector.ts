/**
 * Model Selector — resolve the best available VS Code language model for a given domain.
 * Reads meridian.model.<domain> → meridian.model.default → any available model.
 */

import * as vscode from "vscode";
import { readSetting } from "./settings";

export type ModelDomain = "hygiene" | "git" | "chat";

/**
 * Select the best available language model for the given domain.
 * Reads meridian.model.<domain> setting, falls back to meridian.model.default,
 * then falls back to any available model.
 */
export async function selectModel(
  domain?: ModelDomain
): Promise<vscode.LanguageModelChat | null> {
  // "chat" domain has no dedicated setting; only hygiene/git do.
  const domainFamily =
    domain === "hygiene" ? readSetting("model.hygiene") :
    domain === "git"     ? readSetting("model.git") :
    "";
  const defaultFamily = readSetting("model.default");
  const family = domainFamily || defaultFamily;

  const models = await vscode.lm.selectChatModels({ family });
  if (models.length > 0) return models[0];

  // Fallback: any available model
  const any = await vscode.lm.selectChatModels({});
  return any[0] ?? null;
}
