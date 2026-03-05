/**
 * Impact Analysis Visitor — AST visitor that traces import/call relationships.
 *
 * Extracted from impact-analysis-handler.ts as a pure, independently testable module.
 * No FS access — operates on a pre-constructed ts.Program.
 */

import * as path from "path";
import * as ts from "typescript";

export class ImpactAnalysisVisitor {
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
