import type { ITool, ToolId, ScanOptions, ScanResult, ExportFormat } from '../../types/index.js';

/**
 * Lint & Best Practice analysis tool.
 *
 * Strategy:
 * 1. Run existing linters (ESLint, Prettier, pylint, etc.) and collect results
 * 2. Model-driven analysis for higher-level smells not caught by static rules
 * 3. Suggest linter configuration patches to improve coverage
 *
 * Languages: TypeScript/JavaScript, Python
 */
export class LintTool implements ITool {
  readonly id: ToolId = 'lint';
  readonly name = 'Lint & Best Practice';
  readonly description =
    'Run linters and model-driven analysis for code smells and best practices.';

  private abortController?: AbortController;

  async execute(_options: ScanOptions): Promise<ScanResult> {
    // TODO: Phase 1 — run configured linters
    // TODO: Phase 2 — model review for architectural smells
    // TODO: Phase 3 — suggest linter config improvements
    throw new Error('LintTool.execute not yet implemented');
  }

  cancel(): void {
    this.abortController?.abort();
  }

  export(_result: ScanResult, _format: ExportFormat): string {
    throw new Error('LintTool.export not yet implemented');
  }
}
