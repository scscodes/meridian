/**
 * Impact Analysis Handler — traces the blast radius of a file or function change.
 *
 * Input: file path or function name
 * Analysis: Uses TypeScript Compiler API to trace imports, call sites, and test coverage
 * Output: Prose summary via LLM (e.g., "Changing this affects 4 importers and 2 test files")
 *
 * This handler follows the git domain's prose synthesis pattern:
 * analyze → gather context → synthesize prose via generateProse()
 */

import * as path from "path";
import * as ts from "typescript";
import { ImpactAnalysisVisitor } from "./impact-visitor";
import {
  Handler,
  CommandContext,
  Logger,
  Result,
  success,
  failure,
} from "../../types";
import { generateProse, ProseRequest } from "../../infrastructure/prose-generator";
import { CACHE_SETTINGS } from "../../constants";
import { TtlCache } from "../../infrastructure/cache";
import { getPrompt } from "../../infrastructure/prompt-registry";
import { HYGIENE_ERROR_CODES, GENERIC_ERROR_CODES, INFRASTRUCTURE_ERROR_CODES } from "../../infrastructure/error-codes";

export interface ImpactAnalysisParams {
  filePath?: string; // Absolute or relative path to a .ts file
  functionName?: string; // Name of a function to analyze
}

export interface ImpactAnalysisResult {
  summary: string; // Markdown prose output from LLM
  metrics: {
    importers: number;
    callSites: number;
    testFiles: number;
    dependentFiles: number;
  };
  targetPath?: string;
  targetFunction?: string;
}

interface ImpactContext {
  target: string; // File path or function name
  importers: string[]; // Files that import the target
  callSites: string[]; // Locations where target is called
  testFiles: string[]; // Test files that likely exercise the target
  dependentFiles: string[]; // All files in dependency chain
  analysisType: "file" | "function";
}

class ImpactAnalyzer {
  private cache = new TtlCache<string, ImpactContext>(CACHE_SETTINGS.ANALYTICS_TTL_MS);

  constructor(private logger: Logger) {}

  analyze(
    workspaceRoot: string,
    filePath?: string,
    functionName?: string
  ): ImpactContext | null {
    const cacheKey = `${workspaceRoot}|${filePath || functionName}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Resolve tsconfig
      const tsconfigPath = ts.findConfigFile(
        workspaceRoot,
        ts.sys.fileExists,
        "tsconfig.json"
      );
      if (!tsconfigPath) {
        this.logger.warn("No tsconfig.json found", "ImpactAnalyzer");
        return null;
      }

      // Load config
      const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
      if (configFile.error) {
        this.logger.warn("Failed to read tsconfig", "ImpactAnalyzer");
        return null;
      }

      const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(tsconfigPath)
      );

      // Create program
      const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);

      // Run visitor
      const targetFile = filePath || "";
      const visitor = new ImpactAnalysisVisitor(program, targetFile, functionName);
      const result = visitor.analyze();

      // Build context
      const context: ImpactContext = {
        target: filePath || functionName || "unknown",
        importers: result.importers,
        callSites: result.callSites,
        testFiles: result.testFiles,
        dependentFiles: Array.from(
          new Set([...result.importers, ...result.testFiles])
        ),
        analysisType: filePath ? "file" : "function",
      };

      this.cache.set(cacheKey, context);

      return context;
    } catch (err) {
      this.logger.warn("Impact analysis failed", "ImpactAnalyzer", {
        code: HYGIENE_ERROR_CODES.IMPACT_ANALYSIS_ERROR,
        message: String(err),
      });
      return null;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export function createImpactAnalysisHandler(logger: Logger): Handler<ImpactAnalysisParams, ImpactAnalysisResult> {
  const analyzer = new ImpactAnalyzer(logger);

  return async (_ctx: CommandContext, params: ImpactAnalysisParams): Promise<Result<ImpactAnalysisResult>> => {
    try {
      // Validate input
      if (!params.filePath && !params.functionName) {
        return failure({
          code: GENERIC_ERROR_CODES.INVALID_PARAMS,
          message: "Impact analysis requires either filePath or functionName",
          context: "hygiene.impactAnalysis",
        });
      }

      logger.info(
        `Analyzing impact of ${params.filePath || params.functionName}`,
        "ImpactAnalysisHandler"
      );

      const workspaceRoot = _ctx.workspaceFolders?.[0];
      if (!workspaceRoot) {
        return failure({
          code: INFRASTRUCTURE_ERROR_CODES.WORKSPACE_NOT_FOUND,
          message: "No workspace folder found",
          context: "hygiene.impactAnalysis",
        });
      }

      // Run analysis
      const context = analyzer.analyze(workspaceRoot, params.filePath, params.functionName);
      if (!context) {
        return failure({
          code: HYGIENE_ERROR_CODES.IMPACT_ANALYSIS_ERROR,
          message: "Failed to analyze impact; check TypeScript config and file paths",
          context: "hygiene.impactAnalysis",
        });
      }

      // Generate prose via LLM
      const proseRequest: ProseRequest = {
        domain: "hygiene",
        systemPrompt: getPrompt("IMPACT_ANALYSIS"),
        data: {
          target: context.target,
          type: context.analysisType,
          importerCount: context.importers.length,
          callSiteCount: context.callSites.length,
          testFileCount: context.testFiles.length,
          importers: context.importers.slice(0, 10), // Limit for token efficiency
          testFiles: context.testFiles.slice(0, 5),
        },
      };

      const proseResult = await generateProse(proseRequest);
      if (proseResult.kind === "err") {
        return proseResult; // Forward LLM error
      }

      return success({
        summary: proseResult.value,
        metrics: {
          importers: context.importers.length,
          callSites: context.callSites.length,
          testFiles: context.testFiles.length,
          dependentFiles: context.dependentFiles.length,
        },
        targetPath: params.filePath,
        targetFunction: params.functionName,
      });
    } catch (err) {
      return failure({
        code: HYGIENE_ERROR_CODES.IMPACT_ANALYSIS_ERROR,
        message: `Impact analysis failed: ${err instanceof Error ? err.message : String(err)}`,
        details: err,
        context: "hygiene.impactAnalysis",
      });
    }
  };
}
