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

/**
 * Cache-invalidation callbacks for analyzer caches whose output a webview
 * report consumes. Wired in main.ts where the analyzer instances live; passed
 * to webview providers so the webview-driven "Ignore" action can invalidate
 * stale entries before re-rendering.
 */
export interface WebviewCacheInvalidators {
  /** Clear the GitAnalyzer report cache. */
  readonly invalidateGitAnalytics: () => void;
  /** Clear the HygieneAnalyzer file-scan cache. */
  readonly invalidateHygieneAnalytics: () => void;
}

export function createWebviewPanels(
  context: vscode.ExtensionContext,
  router: CommandRouter,
  workspaceRoot: string,
  getCommandContext: () => CommandContext,
  readPruneConfig: () => PruneConfig,
  invalidators: WebviewCacheInvalidators
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
    },
    invalidators.invalidateGitAnalytics
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
    },
    invalidators.invalidateHygieneAnalytics
  );

  // Session briefing pulls from both analyzers, so an ignore from this surface
  // must invalidate both caches before the next refresh.
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
    },
    () => {
      invalidators.invalidateGitAnalytics();
      invalidators.invalidateHygieneAnalytics();
    }
  );

  return { analyticsPanel, hygieneAnalyticsPanel, sessionBriefingPanel };
}
