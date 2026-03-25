"use strict";
/**
 * Hygiene Domain Service — workspace cleanup and maintenance.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HygieneDomainService = exports.HYGIENE_COMMANDS = void 0;
exports.createHygieneDomain = createHygieneDomain;
const types_1 = require("../../types");
const constants_1 = require("../../constants");
const error_codes_1 = require("../../infrastructure/error-codes");
const scan_handler_1 = require("./scan-handler");
const cleanup_handler_1 = require("./cleanup-handler");
const analytics_service_1 = require("./analytics-service");
const dead_code_analyzer_1 = require("./dead-code-analyzer");
const analytics_handler_1 = require("./analytics-handler");
const impact_analysis_handler_1 = require("./impact-analysis-handler");
/**
 * Hygiene domain commands.
 */
exports.HYGIENE_COMMANDS = [
    "hygiene.scan",
    "hygiene.cleanup",
    "hygiene.showAnalytics",
    "hygiene.impactAnalysis",
];
class HygieneDomainService {
    constructor(workspaceProvider, logger, workspaceRoot, generateProseFn) {
        this.name = "hygiene";
        this.handlers = {};
        this.scanIntervalMs = constants_1.HYGIENE_SETTINGS.SCAN_INTERVAL_MINUTES * 60 * 1000;
        this.logger = logger;
        this.workspaceRoot = workspaceRoot;
        this.analyzer = new analytics_service_1.HygieneAnalyzer();
        this.deadCodeAnalyzer = new dead_code_analyzer_1.DeadCodeAnalyzer(logger);
        // Initialize handlers
        this.handlers = {
            "hygiene.scan": (0, scan_handler_1.createScanHandler)(workspaceProvider, logger, this.deadCodeAnalyzer),
            "hygiene.cleanup": (0, cleanup_handler_1.createCleanupHandler)(workspaceProvider, logger),
            "hygiene.showAnalytics": (0, analytics_handler_1.createShowHygieneAnalyticsHandler)(this.analyzer, this.deadCodeAnalyzer, logger),
            "hygiene.impactAnalysis": (0, impact_analysis_handler_1.createImpactAnalysisHandler)(logger, generateProseFn),
        };
    }
    /**
     * Initialize domain — set up background scan scheduling.
     */
    async initialize() {
        try {
            this.logger.info("Initializing hygiene domain", "HygieneDomainService.initialize");
            if (constants_1.HYGIENE_SETTINGS.ENABLED && this.workspaceRoot) {
                const workspaceRoot = this.workspaceRoot;
                const scanCtx = {
                    extensionPath: "",
                    workspaceFolders: [workspaceRoot],
                };
                const handler = this.handlers["hygiene.scan"];
                this._timer = setInterval(() => {
                    if (handler) {
                        handler(scanCtx, {}).catch((err) => {
                            this.logger.warn("Background hygiene scan failed", "HygieneDomainService", { code: error_codes_1.HYGIENE_ERROR_CODES.HYGIENE_SCAN_ERROR, message: String(err) });
                        });
                    }
                }, this.scanIntervalMs);
                this.logger.info(`Hygiene scan scheduled every ${this.scanIntervalMs / 1000}s`, "HygieneDomainService.initialize");
            }
            return (0, types_1.success)(void 0);
        }
        catch (err) {
            return (0, types_1.failure)({
                code: error_codes_1.HYGIENE_ERROR_CODES.HYGIENE_INIT_ERROR,
                message: "Failed to initialize hygiene domain",
                details: err,
                context: "HygieneDomainService.initialize",
            });
        }
    }
    /**
     * Cleanup — stop background scanning.
     */
    async teardown() {
        this.logger.debug("Tearing down hygiene domain", "HygieneDomainService.teardown");
        if (this._timer !== undefined) {
            clearInterval(this._timer);
            this._timer = undefined;
        }
    }
}
exports.HygieneDomainService = HygieneDomainService;
/**
 * Factory function — creates and returns hygiene domain service.
 */
function createHygieneDomain(workspaceProvider, logger, workspaceRoot, generateProseFn) {
    return new HygieneDomainService(workspaceProvider, logger, workspaceRoot, generateProseFn);
}
//# sourceMappingURL=service.js.map