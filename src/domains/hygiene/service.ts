/**
 * Hygiene Domain Service — workspace cleanup and maintenance.
 */

import {
  DomainService,
  HygieneCommandName,
  Handler,
  Logger,
  WorkspaceProvider,
  Result,
  success,
  failure,
  CommandContext,
  GenerateProseFn,
} from "../../types";
import { HYGIENE_SETTINGS } from "../../constants";
import { HYGIENE_ERROR_CODES } from "../../infrastructure/error-codes";
import { createScanHandler } from "./scan-handler";
import { createCleanupHandler } from "./cleanup-handler";
import { HygieneAnalyzer } from "./analytics-service";
import { DeadCodeAnalyzer } from "./dead-code-analyzer";
import { createShowHygieneAnalyticsHandler } from "./analytics-handler";
import { createImpactAnalysisHandler } from "./impact-analysis-handler";

/**
 * Hygiene domain commands.
 */
export const HYGIENE_COMMANDS: HygieneCommandName[] = [
  "hygiene.scan",
  "hygiene.cleanup",
  "hygiene.showAnalytics",
  "hygiene.impactAnalysis",
];

export class HygieneDomainService implements DomainService {
  readonly name = "hygiene";

  handlers: Partial<Record<HygieneCommandName, Handler<any, any>>> = {};
  public analyzer: HygieneAnalyzer;
  public deadCodeAnalyzer: DeadCodeAnalyzer;
  private logger: Logger;
  private scanIntervalMs: number = HYGIENE_SETTINGS.SCAN_INTERVAL_MINUTES * 60 * 1000;
  private _timer: ReturnType<typeof setInterval> | undefined;
  private readonly workspaceRoot: string | undefined;

  constructor(
    workspaceProvider: WorkspaceProvider,
    logger: Logger,
    workspaceRoot?: string,
    generateProseFn?: GenerateProseFn
  ) {
    this.logger = logger;
    this.workspaceRoot = workspaceRoot;
    this.analyzer = new HygieneAnalyzer();
    this.deadCodeAnalyzer = new DeadCodeAnalyzer(logger);

    // Initialize handlers
    this.handlers = {
      "hygiene.scan": createScanHandler(workspaceProvider, logger, this.deadCodeAnalyzer),
      "hygiene.cleanup": createCleanupHandler(workspaceProvider, logger),
      "hygiene.showAnalytics": createShowHygieneAnalyticsHandler(this.analyzer, this.deadCodeAnalyzer, logger),
      "hygiene.impactAnalysis": createImpactAnalysisHandler(logger, generateProseFn),
    };
  }

  /**
   * Initialize domain — set up background scan scheduling.
   */
  async initialize(): Promise<Result<void>> {
    try {
      this.logger.info(
        "Initializing hygiene domain",
        "HygieneDomainService.initialize"
      );

      if (HYGIENE_SETTINGS.ENABLED && this.workspaceRoot) {
        const workspaceRoot = this.workspaceRoot;
        const scanCtx: CommandContext = {
          extensionPath: "",
          workspaceFolders: [workspaceRoot],
        };
        const handler = this.handlers["hygiene.scan"];
        this._timer = setInterval(() => {
          if (handler) {
            handler(scanCtx, {}).catch((err: unknown) => {
              this.logger.warn(
                "Background hygiene scan failed",
                "HygieneDomainService",
                { code: HYGIENE_ERROR_CODES.HYGIENE_SCAN_ERROR, message: String(err) }
              );
            });
          }
        }, this.scanIntervalMs);

        this.logger.info(
          `Hygiene scan scheduled every ${this.scanIntervalMs / 1000}s`,
          "HygieneDomainService.initialize"
        );
      }

      return success(void 0);
    } catch (err) {
      return failure({
        code: HYGIENE_ERROR_CODES.HYGIENE_INIT_ERROR,
        message: "Failed to initialize hygiene domain",
        details: err,
        context: "HygieneDomainService.initialize",
      });
    }
  }

  /**
   * Cleanup — stop background scanning.
   */
  async teardown(): Promise<void> {
    this.logger.debug(
      "Tearing down hygiene domain",
      "HygieneDomainService.teardown"
    );
    if (this._timer !== undefined) {
      clearInterval(this._timer);
      this._timer = undefined;
    }
  }
}

/**
 * Factory function — creates and returns hygiene domain service.
 */
export function createHygieneDomain(
  workspaceProvider: WorkspaceProvider,
  logger: Logger,
  workspaceRoot?: string,
  generateProseFn?: GenerateProseFn
): HygieneDomainService {
  return new HygieneDomainService(workspaceProvider, logger, workspaceRoot, generateProseFn);
}
