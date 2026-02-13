import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type {
  ToolId,
  ScanOptions,
  Finding,
  IModelProvider,
  SupportedLanguage,
} from '../../types/index.js';
import { BaseTool } from '../base-tool.js';
import { getRepoRoot } from '../../git/executor.js';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Max file content to send to model per file */
const MAX_CONTENT_PER_FILE = 5000;

/** Max files to analyze with model */
const MAX_FILES_FOR_MODEL = 15;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LintToolDeps {
  modelProvider?: IModelProvider;
  cwd: string;
  enabledLanguages: SupportedLanguage[];
}

// ─── Implementation ─────────────────────────────────────────────────────────

/**
 * Lint & Best Practice analysis tool.
 *
 * Phase 1 (Static): Run existing linters and collect results.
 * Phase 2 (Model): Deeper code smell analysis beyond static rules.
 * Phase 3: Suggest linter config improvements.
 */
export class LintTool extends BaseTool {
  readonly id: ToolId = 'lint';
  readonly name = 'Lint & Best Practice';
  readonly description =
    'Run linters and model-driven analysis for code smells and best practices.';

  private deps: LintToolDeps | undefined;
  private filesScannedCount = 0;

  setDeps(deps: LintToolDeps): void {
    this.deps = deps;
  }

  protected override countScannedFiles(): number {
    return this.filesScannedCount;
  }

  protected async run(options: ScanOptions): Promise<Finding[]> {
    if (!this.deps) {
      throw new Error('LintTool: Dependencies not set. Call setDeps() before execute().');
    }

    const { cwd, enabledLanguages, modelProvider } = this.deps;
    const repoRoot = await getRepoRoot(cwd);
    const findings: Finding[] = [];

    // Determine scan paths
    const paths = options.paths && options.paths.length > 0 ? options.paths : ['.'];

    // Phase 1: Run external linters
    this.throwIfCancelled(options);

    if (enabledLanguages.includes('typescript') || enabledLanguages.includes('javascript')) {
      const eslintFindings = await this.runEslint(repoRoot, paths, options);
      findings.push(...eslintFindings);
    }

    if (enabledLanguages.includes('python')) {
      const pylintFindings = await this.runPylint(repoRoot, paths, options);
      findings.push(...pylintFindings);
    }

    this.filesScannedCount = findings.length > 0
      ? new Set(findings.map((f) => f.location.filePath)).size
      : 0;

    // Phase 2: Model-driven analysis
    if (modelProvider) {
      this.throwIfCancelled(options);
      const modelFindings = await this.runModelAnalysis(
        modelProvider,
        repoRoot,
        paths,
        options,
      );
      findings.push(...modelFindings);
    }

    return findings;
  }

  // ─── ESLint ───────────────────────────────────────────────────────────

  private async runEslint(
    cwd: string,
    paths: string[],
    options: ScanOptions,
  ): Promise<Finding[]> {
    this.throwIfCancelled(options);

    try {
      // Run ESLint via npx (it may or may not be installed)
      const { execFile } = await import('node:child_process');
      const eslintResults = await new Promise<string>((resolve) => {
        execFile(
          'npx',
          ['eslint', '--format', 'json', '--no-error-on-unmatched-pattern', ...paths],
          { cwd, timeout: 60_000 },
          (_error, stdout) => {
            resolve(String(stdout));
          },
        );
      });

      return this.parseEslintOutput(eslintResults, cwd);
    } catch {
      // ESLint not available — not an error, just skip
      return [];
    }
  }

  private parseEslintOutput(jsonOutput: string, cwd: string): Finding[] {
    const findings: Finding[] = [];

    try {
      const results = JSON.parse(jsonOutput) as Array<{
        filePath: string;
        messages: Array<{
          line: number;
          column: number;
          message: string;
          ruleId: string | null;
          severity: number;
        }>;
      }>;

      for (const file of results) {
        const relPath = relative(cwd, file.filePath);

        for (const msg of file.messages) {
          findings.push(
            this.createFinding({
              title: msg.ruleId ?? 'lint-error',
              description: msg.message,
              location: {
                filePath: relPath,
                startLine: msg.line,
                endLine: msg.line,
                startColumn: msg.column,
              },
              severity: msg.severity >= 2 ? 'error' : 'warning',
              metadata: { ruleId: msg.ruleId, source: 'eslint' },
            }),
          );
        }
      }
    } catch {
      // JSON parse failure — ESLint output wasn't valid JSON
    }

    return findings;
  }

  // ─── Pylint ───────────────────────────────────────────────────────────

  private async runPylint(
    cwd: string,
    paths: string[],
    options: ScanOptions,
  ): Promise<Finding[]> {
    this.throwIfCancelled(options);

    try {
      const { execFile } = await import('node:child_process');
      const output = await new Promise<string>((resolve) => {
        execFile(
          'python',
          ['-m', 'pylint', '--output-format=json', ...paths],
          { cwd, timeout: 60_000 },
          (_error, stdout) => {
            resolve(String(stdout));
          },
        );
      });

      return this.parsePylintOutput(output, cwd);
    } catch {
      return [];
    }
  }

  private parsePylintOutput(jsonOutput: string, cwd: string): Finding[] {
    const findings: Finding[] = [];

    try {
      const results = JSON.parse(jsonOutput) as Array<{
        path: string;
        line: number;
        column: number;
        message: string;
        'message-id': string;
        symbol: string;
        type: string;
      }>;

      for (const msg of results) {
        findings.push(
          this.createFinding({
            title: `${msg.symbol} (${msg['message-id']})`,
            description: msg.message,
            location: {
              filePath: relative(cwd, msg.path),
              startLine: msg.line,
              endLine: msg.line,
              startColumn: msg.column,
            },
            severity: msg.type === 'error' || msg.type === 'fatal' ? 'error' : 'warning',
            metadata: { ruleId: msg['message-id'], symbol: msg.symbol, source: 'pylint' },
          }),
        );
      }
    } catch {
      // Parse failure
    }

    return findings;
  }

  // ─── Model Analysis ───────────────────────────────────────────────────

  private async runModelAnalysis(
    provider: IModelProvider,
    cwd: string,
    paths: string[],
    options: ScanOptions,
  ): Promise<Finding[]> {
    this.throwIfCancelled(options);
    const findings: Finding[] = [];

    // Collect file contents for model review
    const fileContents: Array<{ path: string; content: string }> = [];

    for (const scanPath of paths) {
      const fullPath = join(cwd, scanPath);
      try {
        const fileStat = await import('node:fs/promises').then((fs) => fs.stat(fullPath));
        if (fileStat.isFile()) {
          const content = await readFile(fullPath, 'utf-8');
          fileContents.push({
            path: relative(cwd, fullPath),
            content: content.slice(0, MAX_CONTENT_PER_FILE),
          });
        }
      } catch {
        // Skip
      }
    }

    if (fileContents.length === 0) return findings;

    // Send to model for analysis
    const fileBlock = fileContents
      .slice(0, MAX_FILES_FOR_MODEL)
      .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
      .join('\n\n');

    try {
      const response = await provider.sendRequest({
        role: 'tool',
        messages: [
          { role: 'system', content: MODEL_SYSTEM_PROMPT },
          { role: 'user', content: `Analyze the following code for best practice issues:\n\n${fileBlock}` },
        ],
        signal: options.signal,
      });

      // Parse model output
      for (const line of response.content.split('\n')) {
        const match = line.match(/^(ISSUE|SUGGESTION)\|([^|]+)\|(\d+)\|(.+)$/);
        if (!match) continue;

        const [_, type, filePath, lineStr, description] = match;
        findings.push(
          this.createFinding({
            title: type === 'SUGGESTION' ? 'Best practice suggestion' : 'Code smell detected',
            description: description.trim(),
            location: {
              filePath: filePath.trim(),
              startLine: parseInt(lineStr, 10),
              endLine: parseInt(lineStr, 10),
            },
            severity: type === 'ISSUE' ? 'warning' : 'info',
            metadata: { source: 'model' },
          }),
        );
      }
    } catch {
      // Model analysis is best-effort
    }

    return findings;
  }
}

const MODEL_SYSTEM_PROMPT = `You are a code quality reviewer. Analyze the provided code for:

1. **Code smells**: duplicated logic, overly complex functions, god objects
2. **Best practices**: missing error handling, unsafe type assertions, hardcoded values
3. **Architecture**: tight coupling, missing abstractions, circular dependencies
4. **Security**: potential injection vulnerabilities, exposed secrets, unsafe operations
5. **Performance**: unnecessary allocations, N+1 patterns, missing memoization

For each issue found, output a line in this format:
ISSUE|filepath|line_number|description
or
SUGGESTION|filepath|line_number|description

Only report significant issues. Skip trivial style preferences that linters already catch.
Be specific about the line number and what should change.`;
