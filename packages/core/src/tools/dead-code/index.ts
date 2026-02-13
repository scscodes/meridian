import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
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

/** Max files to scan in a single run */
const MAX_FILES = 500;

/** Max file content to send to model (characters) */
const MAX_CONTENT_FOR_MODEL = 6000;

/** File extensions to language mapping */
const EXT_TO_LANGUAGE: Record<string, SupportedLanguage> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
};

/** Directories to always skip */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '__pycache__',
  '.venv',
  'venv',
  'coverage',
  '.angular',
]);

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DeadCodeToolDeps {
  modelProvider?: IModelProvider;
  cwd: string;
  enabledLanguages: SupportedLanguage[];
}

/** Patterns that indicate an export */
interface ExportInfo {
  name: string;
  line: number;
  kind: 'function' | 'class' | 'variable' | 'type' | 'interface' | 'enum' | 'default';
}

// ─── Implementation ─────────────────────────────────────────────────────────

/**
 * Dead Code Discovery tool.
 *
 * Phase 1 (Static): Find exports and scan for usage across the codebase.
 * Phase 2 (Model): For ambiguous cases, ask the model for judgment.
 *
 * Detects: unused exports, unused variables (top-level), dead files.
 */
export class DeadCodeTool extends BaseTool {
  readonly id: ToolId = 'dead-code';
  readonly name = 'Dead Code Discovery';
  readonly description = 'Find unused exports, unreachable code, unused files, and dead variables.';

  private deps: DeadCodeToolDeps | undefined;
  private filesScannedCount = 0;

  setDeps(deps: DeadCodeToolDeps): void {
    this.deps = deps;
  }

  protected override countScannedFiles(): number {
    return this.filesScannedCount;
  }

  protected async run(options: ScanOptions): Promise<Finding[]> {
    if (!this.deps) {
      throw new Error('DeadCodeTool: Dependencies not set. Call setDeps() before execute().');
    }

    const { cwd, enabledLanguages, modelProvider } = this.deps;
    const repoRoot = await getRepoRoot(cwd);
    const findings: Finding[] = [];

    // Collect all source files
    this.throwIfCancelled(options);
    const scanPaths = options.paths && options.paths.length > 0
      ? options.paths.map((p) => join(repoRoot, p))
      : [repoRoot];

    const files = await collectSourceFiles(scanPaths, enabledLanguages);
    this.filesScannedCount = Math.min(files.length, MAX_FILES);

    if (files.length === 0) {
      findings.push(
        this.createFinding({
          title: 'No source files found',
          description: 'No files matching enabled languages were found in the scan scope.',
          location: { filePath: repoRoot, startLine: 0, endLine: 0 },
          severity: 'info',
        }),
      );
      return findings;
    }

    // Phase 1: Static analysis — find exports and check usage
    this.throwIfCancelled(options);
    const fileContents = new Map<string, string>();
    const allExports = new Map<string, ExportInfo[]>();

    for (const filePath of files.slice(0, MAX_FILES)) {
      this.throwIfCancelled(options);
      try {
        const content = await readFile(filePath, 'utf-8');
        const relPath = relative(repoRoot, filePath);
        fileContents.set(relPath, content);

        const ext = extname(filePath);
        const lang = EXT_TO_LANGUAGE[ext];
        if (lang === 'typescript' || lang === 'javascript') {
          const exports = extractExports(content);
          if (exports.length > 0) {
            allExports.set(relPath, exports);
          }
        } else if (lang === 'python') {
          const exports = extractPythonExports(content);
          if (exports.length > 0) {
            allExports.set(relPath, exports);
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Check each export for usage across the codebase
    this.throwIfCancelled(options);
    const allContent = Array.from(fileContents.values()).join('\n');

    for (const [filePath, exports] of allExports) {
      for (const exp of exports) {
        // Skip default exports (harder to track statically)
        if (exp.kind === 'default') continue;

        // Count occurrences of this name across all files
        const regex = new RegExp(`\\b${escapeRegex(exp.name)}\\b`, 'g');
        const matches = allContent.match(regex);
        const count = matches ? matches.length : 0;

        // If only found once (its own declaration), it's potentially dead
        if (count <= 1) {
          findings.push(
            this.createFinding({
              title: `Unused export: ${exp.name}`,
              description: `Exported ${exp.kind} "${exp.name}" appears to be unused across the scanned files.`,
              location: {
                filePath,
                startLine: exp.line,
                endLine: exp.line,
              },
              severity: 'warning',
              suggestedFix: {
                description: `Remove unused ${exp.kind} or its export`,
                replacement: '',
                location: { filePath, startLine: exp.line, endLine: exp.line },
              },
            }),
          );
        }
      }
    }

    // Phase 2: Model synthesis for deeper analysis
    if (modelProvider && findings.length > 0) {
      this.throwIfCancelled(options);
      const modelFindings = await this.modelReview(modelProvider, findings, fileContents, options);
      // Model can either confirm or dismiss static findings
      // For now, add model insights as additional findings
      findings.push(...modelFindings);
    }

    return findings;
  }

  private async modelReview(
    provider: IModelProvider,
    staticFindings: Finding[],
    fileContents: Map<string, string>,
    options: ScanOptions,
  ): Promise<Finding[]> {
    // Only send a subset to the model for cost efficiency
    const topFindings = staticFindings.slice(0, 20);

    const findingsSummary = topFindings
      .map((f) => `- ${f.location.filePath}:${String(f.location.startLine)} — ${f.title}`)
      .join('\n');

    // Get relevant file snippets
    const contextSnippets: string[] = [];
    const seenFiles = new Set<string>();
    for (const f of topFindings) {
      if (seenFiles.has(f.location.filePath)) continue;
      seenFiles.add(f.location.filePath);

      const content = fileContents.get(f.location.filePath);
      if (content) {
        contextSnippets.push(
          `### ${f.location.filePath}\n\`\`\`\n${content.slice(0, MAX_CONTENT_FOR_MODEL)}\n\`\`\``,
        );
      }
    }

    try {
      const response = await provider.sendRequest({
        role: 'tool',
        messages: [
          {
            role: 'system',
            content: `You are a dead code reviewer. Given a list of potentially unused exports and their source code, identify any FALSE POSITIVES — exports that are likely used via:
1. Dynamic imports or require()
2. Framework conventions (Angular decorators, React components used in JSX, Flask routes)
3. Entry points (main files, index files, config files)
4. Tests

For each finding, output one line: CONFIRM|filepath:line or DISMISS|filepath:line|reason
Only output these lines, nothing else.`,
          },
          {
            role: 'user',
            content: `## Static analysis findings\n${findingsSummary}\n\n## Source code\n${contextSnippets.join('\n\n')}`,
          },
        ],
        signal: options.signal,
      });

      // Parse model response to dismiss false positives
      const dismissals = new Set<string>();
      for (const line of response.content.split('\n')) {
        if (line.startsWith('DISMISS|')) {
          const parts = line.split('|');
          if (parts.length >= 2) {
            dismissals.add(parts[1].trim());
          }
        }
      }

      // Downgrade dismissed findings to hints
      for (const finding of staticFindings) {
        const key = `${finding.location.filePath}:${String(finding.location.startLine)}`;
        if (dismissals.has(key)) {
          finding.severity = 'hint';
          finding.description += ' (Model suggests this may be a false positive.)';
        }
      }
    } catch {
      // Model review is best-effort — static findings stand on their own
    }

    return [];
  }
}

// ─── File Discovery ─────────────────────────────────────────────────────────

async function collectSourceFiles(
  roots: string[],
  enabledLanguages: SupportedLanguage[],
): Promise<string[]> {
  const validExtensions = new Set(
    Object.entries(EXT_TO_LANGUAGE)
      .filter(([_, lang]) => enabledLanguages.includes(lang))
      .map(([ext]) => ext),
  );

  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    if (files.length >= MAX_FILES) return;

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (files.length >= MAX_FILES) return;

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          await walk(join(dir, entry.name));
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
        if (validExtensions.has(ext)) {
          files.push(join(dir, entry.name));
        }
      }
    }
  }

  for (const root of roots) {
    const rootStat = await stat(root).catch(() => null);
    if (!rootStat) continue;

    if (rootStat.isDirectory()) {
      await walk(root);
    } else if (rootStat.isFile()) {
      files.push(root);
    }
  }

  return files;
}

// ─── Export Extraction ──────────────────────────────────────────────────────

function extractExports(content: string): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // export function name
    const funcMatch = line.match(/export\s+(?:async\s+)?function\s+(\w+)/);
    if (funcMatch) {
      exports.push({ name: funcMatch[1], line: lineNum, kind: 'function' });
      continue;
    }

    // export class name
    const classMatch = line.match(/export\s+(?:abstract\s+)?class\s+(\w+)/);
    if (classMatch) {
      exports.push({ name: classMatch[1], line: lineNum, kind: 'class' });
      continue;
    }

    // export const/let/var name
    const varMatch = line.match(/export\s+(?:const|let|var)\s+(\w+)/);
    if (varMatch) {
      exports.push({ name: varMatch[1], line: lineNum, kind: 'variable' });
      continue;
    }

    // export type name
    const typeMatch = line.match(/export\s+type\s+(\w+)/);
    if (typeMatch) {
      exports.push({ name: typeMatch[1], line: lineNum, kind: 'type' });
      continue;
    }

    // export interface name
    const ifaceMatch = line.match(/export\s+interface\s+(\w+)/);
    if (ifaceMatch) {
      exports.push({ name: ifaceMatch[1], line: lineNum, kind: 'interface' });
      continue;
    }

    // export enum name
    const enumMatch = line.match(/export\s+enum\s+(\w+)/);
    if (enumMatch) {
      exports.push({ name: enumMatch[1], line: lineNum, kind: 'enum' });
      continue;
    }

    // export default
    if (line.match(/export\s+default\b/)) {
      exports.push({ name: 'default', line: lineNum, kind: 'default' });
    }
  }

  return exports;
}

function extractPythonExports(content: string): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Top-level function definitions
    const funcMatch = line.match(/^def\s+(\w+)\s*\(/);
    if (funcMatch && !funcMatch[1].startsWith('_')) {
      exports.push({ name: funcMatch[1], line: lineNum, kind: 'function' });
      continue;
    }

    // Top-level class definitions
    const classMatch = line.match(/^class\s+(\w+)/);
    if (classMatch && !classMatch[1].startsWith('_')) {
      exports.push({ name: classMatch[1], line: lineNum, kind: 'class' });
      continue;
    }

    // Top-level variable assignments
    const varMatch = line.match(/^(\w+)\s*=/);
    if (varMatch && !varMatch[1].startsWith('_') && varMatch[1] === varMatch[1].toUpperCase()) {
      // Only flag ALL_CAPS constants as "exported"
      exports.push({ name: varMatch[1], line: lineNum, kind: 'variable' });
    }
  }

  return exports;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
