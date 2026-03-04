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

class ImpactAnalysisVisitor {
  private importers: Set<string> = new Set();
  private callSites: string[] = [];
  private testFiles: Set<string> = new Set();

  constructor(
    private program: ts.Program,
    private targetFile: string,
    private targetFunction?: string
  ) {}

  analyze(): { importers: string[]; callSites: string[]; testFiles: string[] } {
    const sourceFiles = this.program.getSourceFiles();

    for (const sourceFile of sourceFiles) {
      // Skip declarations and tests for now (analyze later)
      if (sourceFile.fileName.includes(".d.ts")) continue;

      // Track test files
      if (this.isTestFile(sourceFile.fileName)) {
        this.testFiles.add(sourceFile.fileName);
      }

      // Visitor for this file
      ts.forEachChild(sourceFile, (node: ts.Node) => {
        this.visitNode(node, sourceFile.fileName);
      });
    }

    return {
      importers: Array.from(this.importers),
      callSites: this.callSites,
      testFiles: Array.from(this.testFiles),
    };
  }

  private visitNode(node: ts.Node | undefined, fileName: string): void {
    if (!node) return;
    // Check for import statements
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) {
      const importPath = this.extractImportPath(node);
      if (importPath && this.pathsResolveToTarget(importPath)) {
        this.importers.add(fileName);
      }
    }

    // Check for function calls if analyzing a specific function
    if (this.targetFunction && ts.isCallExpression(node)) {
      const funcName = this.extractCallName(node);
      if (funcName === this.targetFunction) {
        this.callSites.push(`${fileName}:${node.getStart()}`);
      }
    }

    // Recurse
    ts.forEachChild(node, (child: ts.Node) => {
      this.visitNode(child, fileName);
    });
  }

  private extractImportPath(node: ts.Node): string | null {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        return moduleSpecifier.text;
      }
    } else if (ts.isImportEqualsDeclaration(node)) {
      const moduleReference = node.moduleReference;
      if (ts.isExternalModuleReference(moduleReference) && ts.isStringLiteral(moduleReference.expression)) {
        return moduleReference.expression.text;
      }
    }
    return null;
  }

  // Simple heuristic: check if path contains target filename stem.
  private pathsResolveToTarget(importPath: string): boolean {
    const targetStem = path.parse(this.targetFile).name;
    // Match ".../name" or "./name" or "../name"
    return importPath.endsWith(`/${targetStem}`) || importPath.endsWith(`\/${targetStem}`);
  }

  private extractCallName(node: ts.CallExpression): string | null {
    const expression = node.expression;
    if (ts.isIdentifier(expression)) {
      return expression.text;
    }
    if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.name)) {
      return expression.name.text;
    }
    return null;
  }

  private isTestFile(fileName: string): boolean {
    return /\.test\.(ts|js)$/.test(fileName) || /\.spec\.(ts|js)$/.test(fileName);
  }
}

class ImpactAnalyzer {
  private cache = new Map<string, ImpactContext>();

  constructor(private logger: Logger) {}

  analyze(
    workspaceRoot: string,
    filePath?: string,
    functionName?: string
  ): ImpactContext | null {
    const cacheKey = `${workspaceRoot}|${filePath || functionName}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - (cached as any).cachedAt < CACHE_SETTINGS.ANALYTICS_TTL_MS) {
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

      // Cache (with timestamp)
      (context as any).cachedAt = Date.now();
      this.cache.set(cacheKey, context);

      return context;
    } catch (err) {
      this.logger.warn("Impact analysis failed", "ImpactAnalyzer", {
        code: "IMPACT_ANALYSIS_ERROR",
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
          code: "INVALID_PARAMS",
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
          code: "WORKSPACE_NOT_FOUND",
          message: "No workspace folder found",
          context: "hygiene.impactAnalysis",
        });
      }

      // Run analysis
      const context = analyzer.analyze(workspaceRoot, params.filePath, params.functionName);
      if (!context) {
        return failure({
          code: "IMPACT_ANALYSIS_ERROR",
          message: "Failed to analyze impact; check TypeScript config and file paths",
          context: "hygiene.impactAnalysis",
        });
      }

      // Generate prose via LLM
      const proseRequest: ProseRequest = {
        domain: "hygiene",
        systemPrompt: `Analyze the following code impact analysis and provide a concise markdown summary.
Format: "Changing this would affect X importers and Y test files. High risk: changes to exports or core functions; low risk: internal-only changes."
Be brief and actionable.`,
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
        code: "IMPACT_ANALYSIS_ERROR",
        message: `Impact analysis failed: ${err instanceof Error ? err.message : String(err)}`,
        details: err,
        context: "hygiene.impactAnalysis",
      });
    }
  };
}
