/**
 * Webview Setup — create analytics and briefing webview panels with dispatch callbacks.
 */

import * as vscode from "vscode";
import { CommandRouter } from "../router";
import { CommandContext } from "../types";
import { GitAnalyticsReport } from "../domains/git/analytics-types";
import { HygieneAnalyticsReport, PruneConfig } from "../domains/hygiene/analytics-types";
import { SessionBriefingReport } from "../domains/git/types";
import {
  AnalyticsWebviewProvider,
  HygieneAnalyticsWebviewProvider,
  SessionBriefingWebviewProvider,
} from "../infrastructure/webview-provider";

export function createWebviewPanels(
  context: vscode.ExtensionContext,
  router: CommandRouter,
  workspaceRoot: string,
  getCommandContext: () => CommandContext,
  readPruneConfig: () => PruneConfig
): {
  analyticsPanel: AnalyticsWebviewProvider;
  hygieneAnalyticsPanel: HygieneAnalyticsWebviewProvider;
  sessionBriefingPanel: SessionBriefingWebviewProvider;
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

  const sessionBriefingPanel = new SessionBriefingWebviewProvider(
    context.extensionUri,
    workspaceRoot,
    async () => {
      const freshCtx = getCommandContext();
      const result = await router.dispatch(
        { name: "git.sessionBriefing", params: {} },
        freshCtx
      );
      if (result.kind === "ok") return result.value as SessionBriefingReport;
      throw new Error((result as any).error?.message ?? "Session briefing failed");
    }
  );

  return { analyticsPanel, hygieneAnalyticsPanel, sessionBriefingPanel };
}
