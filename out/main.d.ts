/**
 * VS Code Extension Entry Point
 * Activates domains, registers commands, sets up middleware.
 */
import * as vscode from "vscode";
import { CommandRouter } from "./router";
export declare function activate(context: vscode.ExtensionContext): Promise<void>;
export declare function deactivate(): Promise<void>;
export { CommandRouter };
export { Logger } from "./infrastructure/logger";
//# sourceMappingURL=main.d.ts.map