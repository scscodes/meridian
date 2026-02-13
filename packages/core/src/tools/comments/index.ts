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
import { getBlame } from '../../git/blame.js';
import type { BlameRange } from '../../git/blame.js';
import { getRepoRoot } from '../../git/executor.js';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Comments older than this (in days) are flagged as stale */
const STALE_THRESHOLD_DAYS = 180;

/** Max file content length to send to the model */
const MAX_FILE_CONTENT_LENGTH = 8000;

/** Comment patterns by language */
const COMMENT_PATTERNS: Record<SupportedLanguage, RegExp[]> = {
  typescript: [
    /^\s*\/\/.*$/gm, // Single-line //
    /^\s*\/\*[\s\S]*?\*\//gm, // Multi-line /* */
  ],
  javascript: [
    /^\s*\/\/.*$/gm,
    /^\s*\/\*[\s\S]*?\*\//gm,
  ],
  python: [
    /^\s*#.*$/gm, // Single-line #
    /^\s*"""[\s\S]*?"""/gm, // Triple-quoted docstrings
    /^\s*'''[\s\S]*?'''/gm,
  ],
};

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

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CommentsToolDeps {
  modelProvider: IModelProvider;
  cwd: string;
  enabledLanguages: SupportedLanguage[];
}

interface CommentBlock {
  content: string;
  startLine: number;
  endLine: number;
  language: SupportedLanguage;
}

// ─── Implementation ─────────────────────────────────────────────────────────

/**
 * Comment Pruning tool.
 *
 * Flow:
 * 1. Find source files matching enabled languages
 * 2. Extract comment blocks from each file
 * 3. Use git blame to determine comment age
 * 4. Flag stale comments (> threshold days old)
 * 5. Send surviving comments to model for value assessment
 * 6. Generate proposals — NEVER auto-apply
 */
export class CommentsTool extends BaseTool {
  readonly id: ToolId = 'comments';
  readonly name = 'Comment Pruning';
  readonly description = 'Identify stale, verbose, or low-value comments for cleanup.';

  private deps: CommentsToolDeps | undefined;

  setDeps(deps: CommentsToolDeps): void {
    this.deps = deps;
  }

  protected async run(options: ScanOptions): Promise<Finding[]> {
    if (!this.deps) {
      throw new Error('CommentsTool: Dependencies not set. Call setDeps() before execute().');
    }

    const { modelProvider, cwd, enabledLanguages } = this.deps;
    const findings: Finding[] = [];
    const repoRoot = await getRepoRoot(cwd);

    // Determine files to scan
    const filePaths = options.paths ?? [];
    if (filePaths.length === 0) {
      // If no paths specified, this tool requires explicit file/dir targets
      findings.push(
        this.createFinding({
          title: 'No files specified',
          description:
            'Comment pruning requires specific files or directories. Use @aidev /comments <path>.',
          location: { filePath: repoRoot, startLine: 0, endLine: 0 },
          severity: 'info',
        }),
      );
      return findings;
    }

    for (const filePath of filePaths) {
      this.throwIfCancelled(options);

      const ext = getExtension(filePath);
      const language = EXT_TO_LANGUAGE[ext];
      if (!language || !enabledLanguages.includes(language)) continue;

      try {
        const fullPath = join(repoRoot, filePath);
        const content = await readFile(fullPath, 'utf-8');
        const relativePath = relative(repoRoot, fullPath);

        // Extract comments
        const comments = extractComments(content, language);
        if (comments.length === 0) continue;

        // Get blame data for age analysis
        let blameRanges: BlameRange[] = [];
        try {
          blameRanges = await getBlame({ cwd: repoRoot, filePath: relativePath });
        } catch {
          // Blame may fail for new/uncommitted files — continue without age data
        }

        // Phase 1: Flag stale comments based on age
        for (const comment of comments) {
          const age = getCommentAge(comment, blameRanges);
          if (age !== undefined && age > STALE_THRESHOLD_DAYS) {
            findings.push(
              this.createFinding({
                title: 'Stale comment',
                description: `Comment unchanged for ${String(Math.round(age))} days. Review if still relevant.`,
                location: {
                  filePath: relativePath,
                  startLine: comment.startLine,
                  endLine: comment.endLine,
                },
                severity: 'info',
                metadata: { ageDays: age, commentContent: comment.content.slice(0, 200) },
              }),
            );
          }
        }

        // Phase 2: Model evaluation for value/verbosity
        this.throwIfCancelled(options);
        const truncatedContent = content.slice(0, MAX_FILE_CONTENT_LENGTH);
        const modelFindings = await evaluateWithModel(
          modelProvider,
          relativePath,
          truncatedContent,
          comments,
          options,
        );
        findings.push(...modelFindings.map((f) => this.createFinding(f)));
      } catch (error) {
        findings.push(
          this.createFinding({
            title: `Error analyzing ${filePath}`,
            description: error instanceof Error ? error.message : String(error),
            location: { filePath, startLine: 0, endLine: 0 },
            severity: 'warning',
          }),
        );
      }
    }

    return findings;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  return lastDot >= 0 ? filePath.slice(lastDot) : '';
}

/**
 * Extract comment blocks from source code.
 */
export function extractComments(content: string, language: SupportedLanguage): CommentBlock[] {
  const patterns = COMMENT_PATTERNS[language] ?? [];
  const blocks: CommentBlock[] = [];

  for (const pattern of patterns) {
    // Reset regex state
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      const startOffset = match.index;
      const endOffset = startOffset + match[0].length;

      // Convert offsets to line numbers
      const startLine = content.slice(0, startOffset).split('\n').length;
      const endLine = content.slice(0, endOffset).split('\n').length;

      blocks.push({
        content: match[0].trim(),
        startLine,
        endLine,
        language,
      });
    }
  }

  // Sort by start line and deduplicate overlapping ranges
  blocks.sort((a, b) => a.startLine - b.startLine);
  return deduplicateRanges(blocks);
}

function deduplicateRanges(blocks: CommentBlock[]): CommentBlock[] {
  if (blocks.length === 0) return [];
  const result: CommentBlock[] = [blocks[0]];

  for (let i = 1; i < blocks.length; i++) {
    const prev = result[result.length - 1];
    const curr = blocks[i];

    // Skip if this block overlaps with the previous one
    if (curr.startLine <= prev.endLine) continue;
    result.push(curr);
  }

  return result;
}

function getCommentAge(comment: CommentBlock, blameRanges: BlameRange[]): number | undefined {
  // Find the blame range that covers the comment's start line
  for (const range of blameRanges) {
    const rangeEnd = range.startLine + range.lineCount - 1;
    if (comment.startLine >= range.startLine && comment.startLine <= rangeEnd) {
      return range.ageDays;
    }
  }
  return undefined;
}

async function evaluateWithModel(
  provider: IModelProvider,
  filePath: string,
  content: string,
  comments: CommentBlock[],
  options: ScanOptions,
): Promise<Array<Omit<Finding, 'id' | 'toolId'>>> {
  if (comments.length === 0) return [];

  const commentSummary = comments
    .map((c) => `L${String(c.startLine)}-${String(c.endLine)}: ${c.content.slice(0, 100)}`)
    .join('\n');

  const response = await provider.sendRequest({
    role: 'tool',
    messages: [
      {
        role: 'system',
        content: MODEL_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `File: ${filePath}\n\n## Source (truncated)\n\`\`\`\n${content}\n\`\`\`\n\n## Comments found\n${commentSummary}\n\nAnalyze each comment. For any that should be removed or tightened, output a line in this format:\nACTION|LINE_START|LINE_END|REASON|REPLACEMENT\n\nACTION is one of: REMOVE, REWRITE, KEEP\nFor KEEP, skip the line (only output REMOVE or REWRITE).\nREPLACEMENT is the suggested new comment text (empty for REMOVE).`,
      },
    ],
    signal: options.signal,
  });

  return parseModelResponse(response.content, filePath);
}

const MODEL_SYSTEM_PROMPT = `You are a code comment reviewer. Evaluate comments for:
1. Staleness — comments about code that has changed since the comment was written
2. Verbosity — comments that are too long for the value they provide
3. Noise — comments that merely restate what the code does (e.g., "increment i")
4. Dead code — commented-out code blocks that should be removed
5. Value — comments that explain WHY, document edge cases, or clarify intent should be KEPT

Be conservative — when in doubt, KEEP the comment. Only flag clear candidates for removal or rewriting.`;

function parseModelResponse(
  content: string,
  filePath: string,
): Array<Omit<Finding, 'id' | 'toolId'>> {
  const findings: Array<Omit<Finding, 'id' | 'toolId'>> = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const parts = line.split('|');
    if (parts.length < 4) continue;

    const [action, startStr, endStr, reason, ...replacementParts] = parts;
    const trimmedAction = action.trim().toUpperCase();
    if (trimmedAction !== 'REMOVE' && trimmedAction !== 'REWRITE') continue;

    const startLine = parseInt(startStr.trim(), 10);
    const endLine = parseInt(endStr.trim(), 10);
    if (isNaN(startLine) || isNaN(endLine)) continue;

    const finding: Omit<Finding, 'id' | 'toolId'> = {
      title: trimmedAction === 'REMOVE' ? 'Remove comment' : 'Rewrite comment',
      description: reason.trim(),
      location: { filePath, startLine, endLine },
      severity: 'info',
    };

    if (trimmedAction === 'REWRITE' && replacementParts.length > 0) {
      finding.suggestedFix = {
        description: 'Suggested rewrite',
        replacement: replacementParts.join('|').trim(),
        location: { filePath, startLine, endLine },
      };
    }

    findings.push(finding);
  }

  return findings;
}
