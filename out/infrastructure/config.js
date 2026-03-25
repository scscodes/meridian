"use strict";
/**
 * Configuration Provider — Typed schema, validation.
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
exports.Config = exports.CONFIG_KEYS = void 0;
const vscode = __importStar(require("vscode"));
const types_1 = require("../types");
const analytics_types_1 = require("../domains/hygiene/analytics-types");
const error_codes_1 = require("./error-codes");
/**
 * Typed configuration schema.
 * No magic keys; all config paths are explicit constants.
 */
exports.CONFIG_KEYS = {
    GIT_AUTOFETCH: "git.autofetch",
    GIT_BRANCH_CLEAN: "git.branchClean",
    HYGIENE_ENABLED: "hygiene.enabled",
    HYGIENE_SCAN_INTERVAL: "hygiene.scanInterval",
    CHAT_MODEL: "chat.model",
    CHAT_CONTEXT_LINES: "chat.contextLines",
    LOG_LEVEL: "log.level",
};
/**
 * Default configuration values.
 */
const DEFAULTS = {
    [exports.CONFIG_KEYS.GIT_AUTOFETCH]: false,
    [exports.CONFIG_KEYS.GIT_BRANCH_CLEAN]: true,
    [exports.CONFIG_KEYS.HYGIENE_ENABLED]: true,
    [exports.CONFIG_KEYS.HYGIENE_SCAN_INTERVAL]: 60,
    [exports.CONFIG_KEYS.CHAT_MODEL]: "gpt-4",
    [exports.CONFIG_KEYS.CHAT_CONTEXT_LINES]: 50,
    [exports.CONFIG_KEYS.LOG_LEVEL]: "info",
};
class Config {
    constructor() {
        this.store = {};
    }
    /**
     * Load config from VS Code workspace settings.
     */
    async initialize() {
        try {
            const cfg = vscode.workspace.getConfiguration("meridian");
            this.store = {
                [exports.CONFIG_KEYS.GIT_AUTOFETCH]: cfg.get("git.autofetch") ?? DEFAULTS[exports.CONFIG_KEYS.GIT_AUTOFETCH],
                [exports.CONFIG_KEYS.GIT_BRANCH_CLEAN]: cfg.get("git.branchClean") ?? DEFAULTS[exports.CONFIG_KEYS.GIT_BRANCH_CLEAN],
                [exports.CONFIG_KEYS.HYGIENE_ENABLED]: cfg.get("hygiene.enabled") ?? DEFAULTS[exports.CONFIG_KEYS.HYGIENE_ENABLED],
                [exports.CONFIG_KEYS.HYGIENE_SCAN_INTERVAL]: cfg.get("hygiene.scanInterval") ?? DEFAULTS[exports.CONFIG_KEYS.HYGIENE_SCAN_INTERVAL],
                [exports.CONFIG_KEYS.CHAT_MODEL]: cfg.get("chat.model") ?? DEFAULTS[exports.CONFIG_KEYS.CHAT_MODEL],
                [exports.CONFIG_KEYS.CHAT_CONTEXT_LINES]: cfg.get("chat.contextLines") ?? DEFAULTS[exports.CONFIG_KEYS.CHAT_CONTEXT_LINES],
                [exports.CONFIG_KEYS.LOG_LEVEL]: cfg.get("log.level") ?? DEFAULTS[exports.CONFIG_KEYS.LOG_LEVEL],
            };
            return (0, types_1.success)(void 0);
        }
        catch (err) {
            // Fall back to defaults so the extension still works
            this.store = { ...DEFAULTS };
            const error = {
                code: error_codes_1.INFRASTRUCTURE_ERROR_CODES.CONFIG_INIT_ERROR,
                message: "Failed to initialize configuration",
                details: err,
            };
            return (0, types_1.failure)(error);
        }
    }
    get(key, defaultValue) {
        const value = this.store[key];
        if (value === undefined) {
            return defaultValue;
        }
        return value;
    }
    async set(key, value) {
        try {
            this.store[key] = value;
            // In extension context, would call vscode.workspace.getConfiguration().update()
            return (0, types_1.success)(void 0);
        }
        catch (err) {
            const error = {
                code: error_codes_1.INFRASTRUCTURE_ERROR_CODES.CONFIG_SET_ERROR,
                message: `Failed to set config key '${key}'`,
                details: err,
            };
            return (0, types_1.failure)(error);
        }
    }
    /**
     * Read current prune config from VS Code settings (reads fresh each call).
     */
    getPruneConfig() {
        const cfg = vscode.workspace.getConfiguration("meridian.hygiene.prune");
        return {
            minAgeDays: cfg.get("minAgeDays", analytics_types_1.PRUNE_DEFAULTS.minAgeDays),
            maxSizeMB: cfg.get("maxSizeMB", analytics_types_1.PRUNE_DEFAULTS.maxSizeMB),
            minLineCount: cfg.get("minLineCount", analytics_types_1.PRUNE_DEFAULTS.minLineCount),
            categories: cfg.get("categories", analytics_types_1.PRUNE_DEFAULTS.categories),
        };
    }
    /**
     * Export current configuration (for debugging).
     */
    exportAll() {
        return { ...this.store };
    }
}
exports.Config = Config;
//# sourceMappingURL=config.js.map