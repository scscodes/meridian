/**
 * Presenter Parity Tests
 *
 * Guards ADR 006 Rule 5: webview-panel specialized presenters must not toast
 * on success. The panel coming forward is the acknowledgement.
 *
 * Also guards the symmetric in-panel error rule: BaseWebviewProvider.handleError
 * must not raise a modal toast — the in-panel banner is the canonical surface.
 *
 * Source-grep checks, not behavior tests: the rule is structural ("don't write
 * this line") and easier to enforce by reading the file than by mocking VS Code.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

describe("presenter parity (ADR 006 Rule 5)", () => {
  it("result-presenters.ts must not call showInformationMessage on success", () => {
    // Specialized webview presenters return true after openPanel; a success
    // toast on top of the panel is the asymmetry this rule exists to prevent.
    const src = readSrc("src/presentation/result-presenters.ts");
    expect(src).not.toMatch(/showInformationMessage/);
  });

  it("BaseWebviewProvider.handleError must not raise a modal toast", () => {
    // The in-panel `type:"error"` banner is the canonical refresh/filter error
    // surface; a vscode.window.showErrorMessage call here would double-notify.
    const src = readSrc("src/infrastructure/webview-provider.ts");
    const handleErrorMatch = src.match(/protected handleError[\s\S]*?\n\s\s\}/);
    expect(handleErrorMatch, "handleError method not found").not.toBeNull();
    expect(handleErrorMatch![0]).not.toMatch(/showErrorMessage|showWarningMessage|showInformationMessage/);
  });
});
