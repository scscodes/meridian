/**
 * Webview Setup — create analytics webview panels with dispatch callbacks.
 */

import * as vscode from "vscode";
import { CommandRouter } from "../router";
import { CommandContext } from "../types";
import { GitAnalyticsReport } from "../domains/git/analytics-types";
import { HygieneAnalyticsReport, PruneConfig } from "../domains/hygiene/analytics-types";
import { AnalyticsWebviewProvider, HygieneAnalyticsWebviewProvider } from "../infrastructure/webview-provider";

export function createWebviewPanels(
  context: vscode.ExtensionContext,
  router: CommandRouter,
  workspaceRoot: string,
  getCommandContext: () => CommandContext,
  readPruneConfig: () => PruneConfig
): {
  analyticsPanel: AnalyticsWebviewProvider;
  hygieneAnalyticsPanel: HygieneAnalyticsWebviewProvider;
} {
  const analyticsPanel = new AnalyticsWebviewProvider(
    context.extensionUri,
    workspaceRoot,
    async (opts) => {
      const freshCtx = getCommandContext();
      const result = await router.dispatch({ name: "git.showAnalytics", params: opts }, freshCtx);
      if (result.kind === "ok") { return result.value as GitAnalyticsReport; }
      throw new Error((result as any).error?.message ?? "Analytics failed");
    }
  );

  const hygieneAnalyticsPanel = new HygieneAnalyticsWebviewProvider(
    context.extensionUri,
    async () => {
      const freshCtx = getCommandContext();
      const result = await router.dispatch(
        { name: "hygiene.showAnalytics", params: readPruneConfig() },
        freshCtx
      );
      if (result.kind === "ok") return result.value as HygieneAnalyticsReport;
      throw new Error((result as any).error?.message ?? "Hygiene analytics failed");
    }
  );

  return { analyticsPanel, hygieneAnalyticsPanel };
}
