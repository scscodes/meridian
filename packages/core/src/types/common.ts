/**
 * Supported programming languages for analysis.
 */
export type SupportedLanguage = 'typescript' | 'javascript' | 'python';

/**
 * Supported frameworks — used for framework-aware analysis heuristics.
 */
export type SupportedFramework =
  | 'angular'
  | 'react'
  | 'nextjs'
  | 'flask'
  | 'fastapi'
  | 'none';

/**
 * A precise location in source code. Used for jump-to-source and inline annotations.
 */
export interface CodeLocation {
  /** Absolute or workspace-relative file path */
  filePath: string;
  /** 1-based start line */
  startLine: number;
  /** 1-based end line */
  endLine: number;
  /** 0-based start column (optional) */
  startColumn?: number;
  /** 0-based end column (optional) */
  endColumn?: number;
}

/**
 * Severity levels for findings — maps to VSCode diagnostic severity.
 */
export type Severity = 'error' | 'warning' | 'info' | 'hint';

/**
 * Supported export formats for scan results.
 */
export type ExportFormat = 'json' | 'markdown';
