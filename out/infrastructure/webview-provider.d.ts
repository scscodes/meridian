/**
 * Webview Providers — base class + Git/Hygiene analytics subclasses.
 *
 * BaseWebviewProvider<T> centralizes: panel lifecycle, buildHtml(), CSP nonce
 * injection, and asset URI rewriting. Subclasses provide view metadata and
 * message handling.
 */
import * as vscode from "vscode";
import { GitAnalyticsReport, AnalyticsOptions } from "../domains/git/analytics-types";
import { HygieneAnalyticsReport } from "../domains/hygiene/analytics-types";
export declare abstract class BaseWebviewProvider<TReport> {
    protected readonly extensionUri: vscode.Uri;
    protected panel: vscode.WebviewPanel | null;
    constructor(extensionUri: vscode.Uri);
    protected abstract getViewId(): string;
    protected abstract getViewTitle(): string;
    protected abstract getUiDirSegments(): string[];
    protected abstract handleMessage(msg: {
        type: string;
        [key: string]: unknown;
    }): Promise<void>;
    openPanel(report: TReport): Promise<void>;
    private buildHtml;
}
export declare class AnalyticsWebviewProvider extends BaseWebviewProvider<GitAnalyticsReport> {
    private readonly workspaceRoot;
    private readonly onFilter;
    constructor(extensionUri: vscode.Uri, workspaceRoot: string, onFilter: (opts: AnalyticsOptions) => Promise<GitAnalyticsReport>);
    protected getViewId(): string;
    protected getViewTitle(): string;
    protected getUiDirSegments(): string[];
    protected handleMessage(msg: {
        type: string;
        payload?: unknown;
    }): Promise<void>;
}
export declare class HygieneAnalyticsWebviewProvider extends BaseWebviewProvider<HygieneAnalyticsReport> {
    private workspaceRoot;
    private readonly onRefresh;
    constructor(extensionUri: vscode.Uri, onRefresh: () => Promise<HygieneAnalyticsReport>);
    protected getViewId(): string;
    protected getViewTitle(): string;
    protected getUiDirSegments(): string[];
    openPanel(report: HygieneAnalyticsReport): Promise<void>;
    protected handleMessage(msg: {
        type: string;
        path?: string;
    }): Promise<void>;
}
//# sourceMappingURL=webview-provider.d.ts.map