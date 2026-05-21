// Export must be host-side because VS Code webview CSP blocks blob downloads.
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { GitAnalyticsReport, AnalyticsOptions } from "../domains/git/analytics-types";
import { gitReportToCsv } from "../domains/git/analytics-service";
import { HygieneAnalyticsReport } from "../domains/hygiene/analytics-types";
import { SessionBriefingReport } from "../domains/git/types";
import { resolveWorkspacePath } from "../security/path-guard";
import { appendIgnorePattern } from "../security/ignore-store";
import { REPORT_LABELS, reportCsvHeader } from "../report-labels";
import { MERIDIAN_DIR, MERIDIAN_ARTIFACTS_DIR } from "../constants";

/**
 * Optional hook a provider can opt into for the webview right-click "Ignore"
 * action. Subclasses pass the workspace root + a callback that invalidates the
 * downstream analyzer cache so the report visibly updates on the next refresh.
 */
export interface IgnoreHooks {
  readonly workspaceRoot: string;
  /** Clear caches of any analyzer whose output this report consumes. */
  readonly invalidateCaches: () => void;
}

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
   * Subclasses that wire up IgnoreHooks return them here. The base routes the
   * webview "ignorePath" message through this hook; subclasses that return
   * null fall through to their own onMessage (or no-op).
   */
  protected getIgnoreHooks(): IgnoreHooks | null {
    return null;
  }

  /**
   * Subclasses override to regenerate-and-push their report after an ignore
   * pattern is added. Default: no-op (report stays as it was; user-visible
   * effect lands on next manual refresh).
   */
  protected async refreshReport(): Promise<void> {
    // override
  }

  /**
   * Route messages: "export", "exportAs", and "ignorePath" handled centrally,
   * everything else delegated to subclass.
   */
  protected async handleMessage(msg: { type: string; [key: string]: unknown }): Promise<void> {
    if (msg.type === "export") {
      await this.handleQuickSave(msg.format as string);
      return;
    }
    if (msg.type === "exportAs") {
      await this.handleSaveAs();
      return;
    }
    if (msg.type === "ignorePath") {
      await this.handleIgnorePath(msg.payload as { path?: string; kind?: string } | undefined);
      return;
    }
    await this.onMessage(msg);
  }

  /**
   * Append a webview-triggered path to .meridian/.meridianignore, invalidate
   * caches, and trigger a refresh so the row visibly disappears (for reports
   * whose data source consults the ignore file). Path comes from a webview so
   * appendIgnorePattern's path-guard is load-bearing.
   */
  protected async handleIgnorePath(
    payload: { path?: string; kind?: string } | undefined
  ): Promise<void> {
    const hooks = this.getIgnoreHooks();
    if (!hooks) return;

    const rawPath = typeof payload?.path === "string" ? payload.path : "";
    const kind = payload?.kind === "folder" ? "folder" : "file";
    if (!rawPath) return;

    const result = appendIgnorePattern(hooks.workspaceRoot, rawPath, kind);
    if (result.kind === "err") {
      vscode.window.showErrorMessage(result.error.message);
      this.panel?.webview.postMessage({ type: "error", payload: result.error.message });
      return;
    }
    if (result.value.alreadyExists) {
      vscode.window.showInformationMessage(
        `Already in .meridian/.meridianignore: ${result.value.pattern}`
      );
      return;
    }

    hooks.invalidateCaches();
    vscode.window.showInformationMessage(
      `Added to .meridian/.meridianignore: ${result.value.pattern}`
    );

    try {
      await this.refreshReport();
    } catch (e) {
      this.handleError("Refresh after ignore failed", e);
    }
  }

  /** True while a webview panel for this report is live. */
  isOpen(): boolean {
    return this.panel !== null;
  }

  /** Bring an already-open panel forward without recomputing the report. */
  reveal(): void {
    this.panel?.reveal(vscode.ViewColumn.One);
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
        this.lastReport = null;
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

  /** Serialize the current report in the requested format, or null if absent/invalid. */
  private serializeReport(format: string): string | null {
    if (!this.lastReport || (format !== "json" && format !== "csv")) return null;
    return format === "json"
      ? this.reportToJson(this.lastReport)
      : this.reportToCsv(this.lastReport);
  }

  /** Timestamped, Windows-safe filename for this report (millisecond precision). */
  private exportFileName(format: string): string {
    // Raw ISO contains ':' and '.', invalid on NTFS — replace to a safe form.
    // Keep milliseconds (slice 23, dropping the trailing 'Z') so two saves in
    // the same second never collide and silently overwrite.
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 23);
    return `${this.getExportFilenamePrefix()}-${ts}.${format}`;
  }

  /** Pure path to the workspace's .meridian/artifacts/ dir (ADR 014), or null if none open. */
  private artifactsDirPath(): string | null {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return null;
    return path.join(workspaceRoot, MERIDIAN_DIR, MERIDIAN_ARTIFACTS_DIR);
  }

  /**
   * Idempotently drop the self-ignoring `.gitignore` (`*`) into an existing
   * artifacts dir so generated reports never enter git. Never clobbers a user
   * edit; non-fatal on failure (logged, not thrown).
   */
  private writeArtifactsGitignore(artifactsDir: string): void {
    try {
      const gitignore = path.join(artifactsDir, ".gitignore");
      if (!fs.existsSync(gitignore)) fs.writeFileSync(gitignore, "*\n", "utf-8");
    } catch (e) {
      console.error("[Meridian] artifacts .gitignore write failed:", e);
    }
  }

  /**
   * Materialize .meridian/artifacts/ (+ self-ignoring `.gitignore`) for a
   * dialog-free write. Returns the path, or null when no workspace is open.
   * Non-fatal: a setup failure is logged and the caller's write surfaces it.
   */
  private ensureArtifactsDir(): string | null {
    const artifactsDir = this.artifactsDirPath();
    if (!artifactsDir) return null;
    try {
      fs.mkdirSync(artifactsDir, { recursive: true });
      this.writeArtifactsGitignore(artifactsDir);
    } catch (e) {
      console.error("[Meridian] artifacts dir setup failed:", e);
    }
    return artifactsDir;
  }

  /**
   * Quick-save: write the report straight into .meridian/artifacts/ with a
   * timestamped name — no dialog. The common case. Requires an open workspace.
   */
  protected async handleQuickSave(format: string): Promise<void> {
    const content = this.serializeReport(format);
    if (content === null) return;

    const artifactsDir = this.ensureArtifactsDir();
    if (!artifactsDir) {
      vscode.window.showErrorMessage("Open a workspace folder to quick-save reports.");
      return;
    }

    const fileName = this.exportFileName(format);
    const target = vscode.Uri.file(path.join(artifactsDir, fileName));
    try {
      await vscode.workspace.fs.writeFile(target, Buffer.from(content, "utf-8"));
    } catch (e) {
      this.handleError("Quick-save failed", e);
      return;
    }
    const rel = path.join(MERIDIAN_DIR, MERIDIAN_ARTIFACTS_DIR, fileName);
    vscode.window.showInformationMessage(`Saved to ${rel}`, "Reveal").then((choice) => {
      if (choice === "Reveal") void vscode.commands.executeCommand("revealInExplorer", target);
    });
  }

  /**
   * Save as…: pick a format, then a location via the save dialog (default
   * .meridian/artifacts/). The escape hatch for saving anywhere.
   */
  protected async handleSaveAs(): Promise<void> {
    const picked = await vscode.window.showQuickPick(["JSON", "CSV"], {
      placeHolder: "Export format",
    });
    if (!picked) return;
    const format = picked.toLowerCase();

    const content = this.serializeReport(format);
    if (content === null) return;

    const defaultName = this.exportFileName(format);
    // Pure path only — don't materialize the dir just to seed the dialog, so a
    // cancelled "Save as…" leaves no empty artifacts dir behind.
    const artifactsDir = this.artifactsDirPath();
    const defaultUri = artifactsDir
      ? vscode.Uri.file(path.join(artifactsDir, defaultName))
      : vscode.Uri.file(defaultName);

    const filters: Record<string, string[]> = format === "json"
      ? { "JSON Files": ["json"] }
      : { "CSV Files": ["csv"] };

    const uri = await vscode.window.showSaveDialog({ defaultUri, filters });
    if (!uri) return;

    try {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"));
    } catch (e) {
      this.handleError("Save failed", e);
      return;
    }
    // If the user kept the default artifacts location, keep that dir git-ignored.
    if (artifactsDir && path.dirname(uri.fsPath) === artifactsDir) {
      this.writeArtifactsGitignore(artifactsDir);
    }
    vscode.window.showInformationMessage(`Exported to ${path.basename(uri.fsPath)}`);
  }

  protected handleError(label: string, e: unknown): void {
    // In-panel banner is the canonical surface for refresh/filter failures —
    // contextual, dismissible, and consistent across all three webviews.
    // No modal toast: panel is already focused; double-notify is noise.
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[Meridian] ${label}:`, e);
    this.panel?.webview.postMessage({ type: "error", payload: msg });
  }

  private buildHtml(webview: vscode.Webview, uiDirUri: vscode.Uri): string {
    const htmlPath = path.join(uiDirUri.fsPath, "index.html");
    let html = fs.readFileSync(htmlPath, "utf-8");

    const nonce = crypto.randomBytes(16).toString("base64");
    const cspSource = webview.cspSource;

    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(uiDirUri, "styles.css"));
    const jsUri  = webview.asWebviewUri(vscode.Uri.joinPath(uiDirUri, "script.js"));
    const chartUri = webview.asWebviewUri(vscode.Uri.joinPath(uiDirUri, "chart.umd.js"));

    html = html.replace(/\{\{NONCE\}\}/g, nonce);
    html = html.replace(/\{\{WEBVIEW_CSP_SOURCE\}\}/g, cspSource);
    html = html.replace(/href="styles\.css"/g, `href="${cssUri}"`);
    html = html.replace(/src="chart\.umd\.js"/g, `src="${chartUri}"`);
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
  private readonly invalidateAnalyticsCaches: (() => void) | undefined;
  /** Period of the report currently displayed, captured at last filter/refresh. */
  private currentPeriod = "3mo";

  constructor(
    extensionUri: vscode.Uri,
    workspaceRoot: string,
    onFilter: (opts: AnalyticsOptions) => Promise<GitAnalyticsReport>,
    invalidateAnalyticsCaches?: () => void
  ) {
    super(extensionUri);
    this.workspaceRoot = workspaceRoot;
    this.onFilter = onFilter;
    this.invalidateAnalyticsCaches = invalidateAnalyticsCaches;
  }

  protected override getIgnoreHooks(): IgnoreHooks | null {
    if (!this.invalidateAnalyticsCaches) return null;
    return {
      workspaceRoot: this.workspaceRoot,
      invalidateCaches: this.invalidateAnalyticsCaches,
    };
  }

  protected override async refreshReport(): Promise<void> {
    const report = await this.onFilter({ period: this.currentPeriod } as AnalyticsOptions);
    this.updateReport(report);
  }

  private openWorkspaceFile(candidatePath: string): void {
    try {
      const abs = resolveWorkspacePath(this.workspaceRoot, candidatePath);
      void vscode.commands.executeCommand("vscode.open", vscode.Uri.file(abs));
    } catch {
      vscode.window.showErrorMessage("Blocked file open outside workspace.");
    }
  }

  protected getViewId(): string { return "meridian.analytics"; }
  protected getViewTitle(): string { return REPORT_LABELS.gitAnalytics; }
  protected getUiDirSegments(): string[] { return ["out", "domains", "git", "analytics-ui"]; }
  protected getExportFilenamePrefix(): string { return "meridian-git-analytics"; }

  protected reportToCsv(report: GitAnalyticsReport): string {
    return gitReportToCsv(report);
  }

  protected async onMessage(msg: { type: string; payload?: unknown }): Promise<void> {
    if (msg.type === "filter") {
      try {
        const opts = (msg.payload as AnalyticsOptions) ?? ({ period: "3mo" } as AnalyticsOptions);
        if (opts.period) this.currentPeriod = opts.period;
        const report = await this.onFilter(opts);
        this.updateReport(report);
      } catch (e) {
        this.handleError("Git analytics filter failed", e);
      }
    } else if (msg.type === "refresh") {
      try {
        const period = (msg.payload as { period?: string })?.period ?? "3mo";
        this.currentPeriod = period;
        const report = await this.onFilter({ period } as AnalyticsOptions);
        this.updateReport(report);
      } catch (e) {
        this.handleError("Git analytics refresh failed", e);
      }
    } else if (msg.type === "openFile") {
      this.openWorkspaceFile(String(msg.payload ?? ""));
    }
  }
}

// ============================================================================
// Hygiene Analytics Webview
// ============================================================================

export class HygieneAnalyticsWebviewProvider extends BaseWebviewProvider<HygieneAnalyticsReport> {
  private resolveWorkspaceFile(candidatePath: string): string | null {
    try {
      return resolveWorkspacePath(this.workspaceRoot, candidatePath);
    } catch {
      vscode.window.showErrorMessage("Blocked file operation outside workspace.");
      return null;
    }
  }

  private workspaceRoot = "";
  private readonly onRefresh: () => Promise<HygieneAnalyticsReport>;
  private readonly invalidateAnalyticsCaches: (() => void) | undefined;

  constructor(
    extensionUri: vscode.Uri,
    onRefresh: () => Promise<HygieneAnalyticsReport>,
    invalidateAnalyticsCaches?: () => void
  ) {
    super(extensionUri);
    this.onRefresh = onRefresh;
    this.invalidateAnalyticsCaches = invalidateAnalyticsCaches;
  }

  protected getViewId(): string { return "meridian.hygiene.analytics"; }
  protected getViewTitle(): string { return REPORT_LABELS.hygieneAnalytics; }
  protected getUiDirSegments(): string[] { return ["out", "domains", "hygiene", "analytics-ui"]; }
  protected getExportFilenamePrefix(): string { return "meridian-hygiene-analytics"; }

  protected override getIgnoreHooks(): IgnoreHooks | null {
    if (!this.workspaceRoot || !this.invalidateAnalyticsCaches) return null;
    return {
      workspaceRoot: this.workspaceRoot,
      invalidateCaches: this.invalidateAnalyticsCaches,
    };
  }

  protected override async refreshReport(): Promise<void> {
    const report = await this.onRefresh();
    this.workspaceRoot = report.workspaceRoot;
    this.updateReport(report);
  }

  override async openPanel(report: HygieneAnalyticsReport): Promise<void> {
    this.workspaceRoot = report.workspaceRoot;
    return super.openPanel(report);
  }

  protected reportToCsv(report: HygieneAnalyticsReport): string {
    const csvStr = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines: string[] = [];

    lines.push(reportCsvHeader(REPORT_LABELS.hygieneAnalytics));
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
        this.handleError("Hygiene analytics refresh failed", e);
      }
    } else if (msg.type === "openFile") {
      const abs = this.resolveWorkspaceFile(String(msg.path ?? ""));
      if (abs) {
        void vscode.commands.executeCommand("vscode.open", vscode.Uri.file(abs));
      }
    } else if (msg.type === "revealFile") {
      const abs = this.resolveWorkspaceFile(String(msg.path ?? ""));
      if (abs) {
        void vscode.commands.executeCommand("revealInExplorer", vscode.Uri.file(abs));
      }
    }
  }
}

// ============================================================================
// Session Briefing Webview
// ============================================================================

export class SessionBriefingWebviewProvider extends BaseWebviewProvider<SessionBriefingReport> {
  private openWorkspaceFile(candidatePath: string): void {
    try {
      const abs = resolveWorkspacePath(this.workspaceRoot, candidatePath);
      void vscode.commands.executeCommand("vscode.open", vscode.Uri.file(abs));
    } catch {
      vscode.window.showErrorMessage("Blocked file open outside workspace.");
    }
  }

  private readonly workspaceRoot: string;
  private readonly onRefresh: () => Promise<SessionBriefingReport>;
  private readonly invalidateAnalyticsCaches: (() => void) | undefined;

  constructor(
    extensionUri: vscode.Uri,
    workspaceRoot: string,
    onRefresh: () => Promise<SessionBriefingReport>,
    invalidateAnalyticsCaches?: () => void
  ) {
    super(extensionUri);
    this.workspaceRoot = workspaceRoot;
    this.onRefresh = onRefresh;
    this.invalidateAnalyticsCaches = invalidateAnalyticsCaches;
  }

  protected getViewId(): string { return "meridian.sessionBriefing"; }
  protected getViewTitle(): string { return REPORT_LABELS.sessionBriefing; }
  protected getUiDirSegments(): string[] { return ["out", "domains", "git", "session-briefing-ui"]; }
  protected getExportFilenamePrefix(): string { return "meridian-session-briefing"; }

  protected override getIgnoreHooks(): IgnoreHooks | null {
    if (!this.invalidateAnalyticsCaches) return null;
    return {
      workspaceRoot: this.workspaceRoot,
      invalidateCaches: this.invalidateAnalyticsCaches,
    };
  }

  protected override async refreshReport(): Promise<void> {
    const report = await this.onRefresh();
    this.updateReport(report);
  }

  protected reportToCsv(report: SessionBriefingReport): string {
    const csvStr = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines: string[] = [];

    lines.push(reportCsvHeader(REPORT_LABELS.sessionBriefing));
    lines.push(`Generated,${report.generatedAt}`);
    lines.push(`Branch,${csvStr(report.branch)}`);
    lines.push(`Dirty,${report.isDirty}`);
    lines.push(`Staged,${report.staged}`);
    lines.push(`Unstaged,${report.unstaged}`);
    lines.push(`Untracked,${report.untracked}`);
    lines.push("");

    lines.push("Recent Commits");
    lines.push("Hash,Author,Message,Insertions,Deletions");
    for (const c of report.recentCommits) {
      lines.push(`${c.shortHash},${csvStr(c.author)},${csvStr(c.message)},${c.insertions},${c.deletions}`);
    }
    lines.push("");

    lines.push("Uncommitted Files");
    lines.push("Path,Status");
    for (const f of report.uncommittedFiles) {
      lines.push(`${csvStr(f.path)},${f.status}`);
    }

    const w = report.activityWindow;
    if (w) {
      lines.push("");
      lines.push("Activity");
      lines.push(`Period,${w.period}`);
      lines.push(`Commits In Window,${w.commitsInWindow}`);
      lines.push(`Files Touched,${w.filesTouched}`);
      if (w.trends) {
        lines.push(`Commit Trend,${w.trends.commitDirection}`);
        lines.push(`Commit Confidence,${w.trends.commitConfidence}`);
        lines.push(`Volatility Trend,${w.trends.volatilityDirection}`);
      }
      lines.push("");
      lines.push("Top Contributors");
      lines.push("Name,Commits");
      for (const a of w.topContributors) {
        lines.push(`${csvStr(a.name)},${a.commits}`);
      }
      if (w.topChurnFiles && w.topChurnFiles.length > 0) {
        lines.push("");
        lines.push("Top Churn Files");
        lines.push("Path,Volatility,Risk");
        for (const f of w.topChurnFiles) {
          lines.push(`${csvStr(f.path)},${f.volatility},${f.risk}`);
        }
      }
    }

    const h = report.hygieneSnapshot;
    if (h) {
      lines.push("");
      lines.push("Hygiene");
      lines.push(`Scanned At,${h.scannedAt}`);
      lines.push(`Dead Files,${h.deadFileCount}`);
      lines.push(`Large Files,${h.largeFileCount}`);
      lines.push(`Log Files,${h.logFileCount}`);
      lines.push(`Dead Code Items,${h.deadCodeItemCount}`);
      if (h.deadCodeSample && h.deadCodeSample.length > 0) {
        lines.push("");
        lines.push("Dead Code Sample");
        lines.push("File,Line,Message");
        for (const d of h.deadCodeSample) {
          lines.push(`${csvStr(d.filePath)},${d.line},${csvStr(d.message)}`);
        }
      }
    }

    const pr = report.pendingChangeRisk;
    if (pr && pr.files.length > 0) {
      lines.push("");
      lines.push("Pending-Change Risk");
      lines.push(`Total Changed,${pr.totalChanged}`);
      lines.push(`High-Risk,${pr.hotspotCount}`);
      lines.push(`Capped,${pr.capped}`);
      lines.push("");
      lines.push("Path,Status,Churn,Volatility,Risk");
      for (const f of pr.files) {
        lines.push(
          `${csvStr(f.path)},${f.status},${f.churn ?? ""},${f.volatility ?? ""},${f.risk}`
        );
      }
    }

    return lines.join("\n");
  }

  protected async onMessage(msg: { type: string; [key: string]: unknown }): Promise<void> {
    if (msg.type === "refresh") {
      try {
        const report = await this.onRefresh();
        this.updateReport(report);
      } catch (e) {
        this.handleError("Session briefing refresh failed", e);
      }
    } else if (msg.type === "openFile") {
      this.openWorkspaceFile(String(msg.payload ?? ""));
    }
  }
}
