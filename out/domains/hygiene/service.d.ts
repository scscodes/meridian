/**
 * Hygiene Domain Service — workspace cleanup and maintenance.
 */
import { DomainService, HygieneCommandName, Handler, Logger, WorkspaceProvider, Result, GenerateProseFn } from "../../types";
import { HygieneAnalyzer } from "./analytics-service";
import { DeadCodeAnalyzer } from "./dead-code-analyzer";
/**
 * Hygiene domain commands.
 */
export declare const HYGIENE_COMMANDS: HygieneCommandName[];
export declare class HygieneDomainService implements DomainService {
    readonly name = "hygiene";
    handlers: Partial<Record<HygieneCommandName, Handler<any, any>>>;
    analyzer: HygieneAnalyzer;
    deadCodeAnalyzer: DeadCodeAnalyzer;
    private logger;
    private scanIntervalMs;
    private _timer;
    private readonly workspaceRoot;
    constructor(workspaceProvider: WorkspaceProvider, logger: Logger, workspaceRoot?: string, generateProseFn?: GenerateProseFn);
    /**
     * Initialize domain — set up background scan scheduling.
     */
    initialize(): Promise<Result<void>>;
    /**
     * Cleanup — stop background scanning.
     */
    teardown(): Promise<void>;
}
/**
 * Factory function — creates and returns hygiene domain service.
 */
export declare function createHygieneDomain(workspaceProvider: WorkspaceProvider, logger: Logger, workspaceRoot?: string, generateProseFn?: GenerateProseFn): HygieneDomainService;
//# sourceMappingURL=service.d.ts.map