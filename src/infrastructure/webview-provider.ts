/**
 * Webview Providers — base class + Git/Hygiene analytics subclasses.
 *
 * BaseWebviewProvider<T> centralizes: panel lifecycle, buildHtml(), CSP nonce
 * injection, asset URI rewriting, and export (save dialog + file write).
 * Subclasses provide view metadata, domain-specific message handling, and CSV formatting.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { GitAnalyticsReport, AnalyticsOptions } from "../domains/git/analytics-types";
import { gitReportToCsv } from "../domains/git/analytics-service";
import { HygieneAnalyticsReport } from "../domains/hygiene/analytics-types";

// ============================================================================
// Base Class
// ============================================================================

export abstract class BaseWebviewProvider<TReport> {
  protected panel: vscode.WebviewPanel | null = null;
  protected lastReport: TReport | null = null;

  constructor(protected readonly extensionUri: vscode.Uri) {}

  protected abstract getViewId(): string;
  protected abstract getViewTitle(): string;
  protected abstract getUiDirSegments(): string[];
  protected abstract getExportFilenamePrefix(): string;
  protected abstract reportToCsv(report: TReport): string;
  protected abstract onMessage(msg: { type: string; [key: string]: unknown }): Promise<void>;

  /**
   * Route messages: "export" handled centrally, everything else delegated to subclass.
   */
  protected async handleMessage(msg: { type: string; [key: string]: unknown }): Promise<void> {
    if (msg.type === "export") {
      await this.handleExport(msg.format as string);
      return;
    }
    await this.onMessage(msg);
  }

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

    this.updateReport(report);
  }

  /**
   * Cache report and push to webview. Called on initial open and every refresh.
   */
  protected updateReport(report: TReport): void {
    this.lastReport = report;
    this.panel?.webview.postMessage({ type: "init", payload: report });
  }

  protected reportToJson(report: TReport): string {
    return JSON.stringify(report, (_key, value) => {
      if (value instanceof Date) return value.toISOString();
      return value;
    }, 2);
  }

  protected async handleExport(format: string): Promise<void> {
    if (!this.lastReport || (format !== "json" && format !== "csv")) return;

    const content = format === "json"
      ? this.reportToJson(this.lastReport)
      : this.reportToCsv(this.lastReport);

    const ts = new Date().toISOString().slice(0, 10);
    const defaultName = `${this.getExportFilenamePrefix()}-${ts}.${format}`;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
    const defaultUri = workspaceFolder
      ? vscode.Uri.joinPath(workspaceFolder, defaultName)
      : vscode.Uri.file(defaultName);

    const filters: Record<string, string[]> = format === "json"
      ? { "JSON Files": ["json"] }
      : { "CSV Files": ["csv"] };

    const uri = await vscode.window.showSaveDialog({ defaultUri, filters });
    if (!uri) return;

    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"));
    vscode.window.showInformationMessage(`Exported to ${path.basename(uri.fsPath)}`);
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
  protected getExportFilenamePrefix(): string { return "meridian-git-analytics"; }

  protected reportToCsv(report: GitAnalyticsReport): string {
    return gitReportToCsv(report);
  }

  protected async onMessage(msg: { type: string; payload?: unknown }): Promise<void> {
    if (msg.type === "filter") {
      try {
        const report = await this.onFilter(msg.payload as AnalyticsOptions);
        this.updateReport(report);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error("[Meridian] git analytics filter error:", e);
        this.panel?.webview.postMessage({ type: "error", payload: errMsg });
        vscode.window.showErrorMessage(`Git analytics filter failed: ${errMsg}`);
      }
    } else if (msg.type === "refresh") {
      try {
        const period = (msg.payload as any)?.period ?? "3mo";
        const report = await this.onFilter({ period } as AnalyticsOptions);
        this.updateReport(report);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error("[Meridian] git analytics refresh error:", e);
        this.panel?.webview.postMessage({ type: "error", payload: errMsg });
        vscode.window.showErrorMessage(`Git analytics refresh failed: ${errMsg}`);
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
  protected getExportFilenamePrefix(): string { return "meridian-hygiene-analytics"; }

  override async openPanel(report: HygieneAnalyticsReport): Promise<void> {
    this.workspaceRoot = report.workspaceRoot;
    return super.openPanel(report);
  }

  protected reportToCsv(report: HygieneAnalyticsReport): string {
    const csvStr = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines: string[] = [];

    lines.push("Hygiene Analytics Report");
    lines.push(`Generated,${report.generatedAt instanceof Date ? report.generatedAt.toISOString() : String(report.generatedAt)}`);
    lines.push(`Workspace,${csvStr(report.workspaceRoot)}`);
    lines.push(`Total Files,${report.summary.totalFiles}`);
    lines.push(`Prune Candidates,${report.summary.pruneCount}`);
    lines.push(`Estimated Savings,${(report.summary.pruneEstimateSizeBytes / 1024).toFixed(1)} KB`);
    lines.push("");

    lines.push("Files");
    lines.push("Path,Size (bytes),Lines,Age (days),Category,Prune Candidate");
    for (const f of report.files) {
      lines.push(
        `${csvStr(f.path)},${f.sizeBytes},${f.lineCount},${f.ageDays},${f.category},${f.isPruneCandidate}`
      );
    }

    return lines.join("\n");
  }

  protected async onMessage(msg: { type: string; [key: string]: unknown }): Promise<void> {
    if (msg.type === "refresh") {
      try {
        const report = await this.onRefresh();
        this.updateReport(report);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error("[Meridian] hygiene analytics refresh error:", e);
        this.panel?.webview.postMessage({ type: "error", payload: errMsg });
        vscode.window.showErrorMessage(`Hygiene analytics refresh failed: ${errMsg}`);
      }
    } else if (msg.type === "openFile") {
      const abs = path.join(this.workspaceRoot, msg["path"] as string);
      vscode.commands.executeCommand("vscode.open", vscode.Uri.file(abs));
    } else if (msg.type === "revealFile") {
      const abs = path.join(this.workspaceRoot, msg["path"] as string);
      vscode.commands.executeCommand("revealInExplorer", vscode.Uri.file(abs));
    }
  }
}
