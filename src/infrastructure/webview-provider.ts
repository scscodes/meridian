/**
 * Webview Providers — base class + Git/Hygiene analytics subclasses.
 *
 * BaseWebviewProvider<T> centralizes: panel lifecycle, buildHtml(), CSP nonce
 * injection, and asset URI rewriting. Subclasses provide view metadata and
 * message handling.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { GitAnalyticsReport, AnalyticsOptions } from "../domains/git/analytics-types";
import { HygieneAnalyticsReport } from "../domains/hygiene/analytics-types";

// ============================================================================
// Base Class
// ============================================================================

export abstract class BaseWebviewProvider<TReport> {
  protected panel: vscode.WebviewPanel | null = null;

  constructor(protected readonly extensionUri: vscode.Uri) {}

  protected abstract getViewId(): string;
  protected abstract getViewTitle(): string;
  protected abstract getUiDirSegments(): string[];
  protected abstract handleMessage(msg: any): Promise<void>;

  async openPanel(report: TReport): Promise<void> {
    const uiDirUri = vscode.Uri.joinPath(this.extensionUri, ...this.getUiDirSegments());

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        this.getViewId(),
        this.getViewTitle(),
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [uiDirUri],
          retainContextWhenHidden: true,
        }
      );

      this.panel.onDidDispose(() => {
        this.panel = null;
      });

      this.panel.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
      this.panel.webview.html = this.buildHtml(this.panel.webview, uiDirUri);
    }

    this.panel.webview.postMessage({ type: "init", payload: report });
  }

  private buildHtml(webview: vscode.Webview, uiDirUri: vscode.Uri): string {
    const htmlPath = path.join(uiDirUri.fsPath, "index.html");
    let html = fs.readFileSync(htmlPath, "utf-8");

    const nonce = crypto.randomBytes(16).toString("base64");
    const cspSource = webview.cspSource;

    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(uiDirUri, "styles.css"));
    const jsUri  = webview.asWebviewUri(vscode.Uri.joinPath(uiDirUri, "script.js"));

    html = html.replace(/\{\{NONCE\}\}/g, nonce);
    html = html.replace(/\{\{WEBVIEW_CSP_SOURCE\}\}/g, cspSource);
    html = html.replace(/href="styles\.css"/g, `href="${cssUri}"`);
    html = html.replace(/src="script\.js"/g, `src="${jsUri}"`);

    return html;
  }
}

// ============================================================================
// Git Analytics Webview
// ============================================================================

export class AnalyticsWebviewProvider extends BaseWebviewProvider<GitAnalyticsReport> {
  private readonly workspaceRoot: string;
  private readonly onFilter: (opts: AnalyticsOptions) => Promise<GitAnalyticsReport>;

  constructor(
    extensionUri: vscode.Uri,
    workspaceRoot: string,
    onFilter: (opts: AnalyticsOptions) => Promise<GitAnalyticsReport>
  ) {
    super(extensionUri);
    this.workspaceRoot = workspaceRoot;
    this.onFilter = onFilter;
  }

  protected getViewId(): string { return "meridian.analytics"; }
  protected getViewTitle(): string { return "Git Analytics — Meridian"; }
  protected getUiDirSegments(): string[] { return ["out", "domains", "git", "analytics-ui"]; }

  protected async handleMessage(msg: { type: string; payload?: unknown }): Promise<void> {
    if (msg.type === "filter") {
      try {
        const report = await this.onFilter(msg.payload as AnalyticsOptions);
        this.panel?.webview.postMessage({ type: "init", payload: report });
      } catch (e) {
        console.error("[Meridian] git analytics filter error:", e);
      }
    } else if (msg.type === "refresh") {
      try {
        const period = (msg.payload as any)?.period ?? "3mo";
        const report = await this.onFilter({ period } as AnalyticsOptions);
        this.panel?.webview.postMessage({ type: "init", payload: report });
      } catch (e) {
        console.error("[Meridian] git analytics refresh error:", e);
      }
    } else if (msg.type === "openFile") {
      const abs = path.join(this.workspaceRoot, msg.payload as string);
      vscode.commands.executeCommand("vscode.open", vscode.Uri.file(abs));
    }
  }
}

// ============================================================================
// Hygiene Analytics Webview
// ============================================================================

export class HygieneAnalyticsWebviewProvider extends BaseWebviewProvider<HygieneAnalyticsReport> {
  private workspaceRoot = "";
  private readonly onRefresh: () => Promise<HygieneAnalyticsReport>;

  constructor(
    extensionUri: vscode.Uri,
    onRefresh: () => Promise<HygieneAnalyticsReport>
  ) {
    super(extensionUri);
    this.onRefresh = onRefresh;
  }

  protected getViewId(): string { return "meridian.hygiene.analytics"; }
  protected getViewTitle(): string { return "Hygiene Analytics — Meridian"; }
  protected getUiDirSegments(): string[] { return ["out", "domains", "hygiene", "analytics-ui"]; }

  override async openPanel(report: HygieneAnalyticsReport): Promise<void> {
    this.workspaceRoot = report.workspaceRoot;
    return super.openPanel(report);
  }

  protected async handleMessage(msg: { type: string; path?: string }): Promise<void> {
    if (msg.type === "refresh") {
      try {
        const report = await this.onRefresh();
        this.panel?.webview.postMessage({ type: "init", payload: report });
      } catch (e) {
        console.error("[Meridian] hygiene analytics refresh error:", e);
      }
    } else if (msg.type === "openSettings") {
      vscode.commands.executeCommand("workbench.action.openSettings", "meridian.hygiene");
    } else if (msg.type === "openFile") {
      const abs = path.join(this.workspaceRoot, msg.path as string);
      vscode.commands.executeCommand("vscode.open", vscode.Uri.file(abs));
    } else if (msg.type === "revealFile") {
      const abs = path.join(this.workspaceRoot, msg.path as string);
      vscode.commands.executeCommand("revealInExplorer", vscode.Uri.file(abs));
    }
  }
}
