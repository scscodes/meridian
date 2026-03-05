"use strict";
/**
 * Webview Providers — base class + Git/Hygiene analytics subclasses.
 *
 * BaseWebviewProvider<T> centralizes: panel lifecycle, buildHtml(), CSP nonce
 * injection, and asset URI rewriting. Subclasses provide view metadata and
 * message handling.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HygieneAnalyticsWebviewProvider = exports.AnalyticsWebviewProvider = exports.BaseWebviewProvider = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
// ============================================================================
// Base Class
// ============================================================================
class BaseWebviewProvider {
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
        this.panel = null;
    }
    async openPanel(report) {
        const uiDirUri = vscode.Uri.joinPath(this.extensionUri, ...this.getUiDirSegments());
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
        }
        else {
            this.panel = vscode.window.createWebviewPanel(this.getViewId(), this.getViewTitle(), vscode.ViewColumn.One, {
                enableScripts: true,
                localResourceRoots: [uiDirUri],
                retainContextWhenHidden: true,
            });
            this.panel.onDidDispose(() => {
                this.panel = null;
            });
            this.panel.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
            this.panel.webview.html = this.buildHtml(this.panel.webview, uiDirUri);
        }
        this.panel.webview.postMessage({ type: "init", payload: report });
    }
    buildHtml(webview, uiDirUri) {
        const htmlPath = path.join(uiDirUri.fsPath, "index.html");
        let html = fs.readFileSync(htmlPath, "utf-8");
        const nonce = crypto.randomBytes(16).toString("base64");
        const cspSource = webview.cspSource;
        const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(uiDirUri, "styles.css"));
        const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(uiDirUri, "script.js"));
        html = html.replace(/\{\{NONCE\}\}/g, nonce);
        html = html.replace(/\{\{WEBVIEW_CSP_SOURCE\}\}/g, cspSource);
        html = html.replace(/href="styles\.css"/g, `href="${cssUri}"`);
        html = html.replace(/src="script\.js"/g, `src="${jsUri}"`);
        return html;
    }
}
exports.BaseWebviewProvider = BaseWebviewProvider;
// ============================================================================
// Git Analytics Webview
// ============================================================================
class AnalyticsWebviewProvider extends BaseWebviewProvider {
    constructor(extensionUri, workspaceRoot, onFilter) {
        super(extensionUri);
        this.workspaceRoot = workspaceRoot;
        this.onFilter = onFilter;
    }
    getViewId() { return "meridian.analytics"; }
    getViewTitle() { return "Git Analytics — Meridian"; }
    getUiDirSegments() { return ["out", "domains", "git", "analytics-ui"]; }
    async handleMessage(msg) {
        if (msg.type === "filter") {
            try {
                const report = await this.onFilter(msg.payload);
                this.panel?.webview.postMessage({ type: "init", payload: report });
            }
            catch (e) {
                console.error("[Meridian] git analytics filter error:", e);
            }
        }
        else if (msg.type === "refresh") {
            try {
                const period = msg.payload?.period ?? "3mo";
                const report = await this.onFilter({ period });
                this.panel?.webview.postMessage({ type: "init", payload: report });
            }
            catch (e) {
                console.error("[Meridian] git analytics refresh error:", e);
            }
        }
        else if (msg.type === "openFile") {
            const abs = path.join(this.workspaceRoot, msg.payload);
            vscode.commands.executeCommand("vscode.open", vscode.Uri.file(abs));
        }
    }
}
exports.AnalyticsWebviewProvider = AnalyticsWebviewProvider;
// ============================================================================
// Hygiene Analytics Webview
// ============================================================================
class HygieneAnalyticsWebviewProvider extends BaseWebviewProvider {
    constructor(extensionUri, onRefresh) {
        super(extensionUri);
        this.workspaceRoot = "";
        this.onRefresh = onRefresh;
    }
    getViewId() { return "meridian.hygiene.analytics"; }
    getViewTitle() { return "Hygiene Analytics — Meridian"; }
    getUiDirSegments() { return ["out", "domains", "hygiene", "analytics-ui"]; }
    async openPanel(report) {
        this.workspaceRoot = report.workspaceRoot;
        return super.openPanel(report);
    }
    async handleMessage(msg) {
        if (msg.type === "refresh") {
            try {
                const report = await this.onRefresh();
                this.panel?.webview.postMessage({ type: "init", payload: report });
            }
            catch (e) {
                console.error("[Meridian] hygiene analytics refresh error:", e);
            }
        }
        else if (msg.type === "openSettings") {
            vscode.commands.executeCommand("workbench.action.openSettings", "meridian.hygiene");
        }
        else if (msg.type === "openFile") {
            const abs = path.join(this.workspaceRoot, msg.path);
            vscode.commands.executeCommand("vscode.open", vscode.Uri.file(abs));
        }
        else if (msg.type === "revealFile") {
            const abs = path.join(this.workspaceRoot, msg.path);
            vscode.commands.executeCommand("revealInExplorer", vscode.Uri.file(abs));
        }
    }
}
exports.HygieneAnalyticsWebviewProvider = HygieneAnalyticsWebviewProvider;
//# sourceMappingURL=webview-provider.js.map