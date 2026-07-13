/**
 * Core type definitions for the DDD-based command router.
 * No external dependencies; explicit types, no magic.
 */

// ============================================================================
// Result Monad — Either<Error, Success>
// ============================================================================

export type Result<T> =
  | { kind: "ok"; value: T }
  | { kind: "err"; error: AppError };

export function success<T>(value: T): Result<T> {
  return { kind: "ok", value };
}

export function failure<T>(error: AppError): Result<T> {
  return { kind: "err", error };
}

export interface AppError {
  code: string;
  message: string;
  details?: unknown;
  context?: string;
}

// ============================================================================
// Command Routing & Handlers
// ============================================================================

export interface CommandContext {
  extensionPath: string;
  workspaceFolders: string[];
  activeFilePath?: string;
  runId?: string;
  parentRunId?: string;
}

export interface Command<P = unknown> {
  name: CommandName;
  params: P;
}

// Discriminated union of all commands (extensible per domain)
export type CommandName =
  | GitCommandName
  | HygieneCommandName;

export type GitCommandName =
  | "git.status"
  | "git.pull"
  | "git.commit"
  | "git.showAnalytics"
  | "git.sessionBriefing";
export type HygieneCommandName =
  | "hygiene.scan"
  | "hygiene.cleanup"
  | "hygiene.showAnalytics"
  | "hygiene.impactAnalysis"
  | "hygiene.storageStatus"
  | "hygiene.pruneStorage";

// ============================================================================
// Handler Interface (Aiogram-style Router Pattern)
// ============================================================================

export type Handler<P = unknown, R = unknown> = (
  ctx: CommandContext,
  params: P
) => Promise<Result<R>>;

export interface HandlerRegistry {
  [name: string]: Handler<any, any>;
}

export type DomainHandlers = {
  [K in CommandName]: Handler<any, any>;
};

// ============================================================================
// Domain Service Interface
// ============================================================================

export interface DomainService {
  name: string;
  handlers: Partial<HandlerRegistry>;
  initialize?(): Promise<Result<void>>;
  teardown?(): Promise<void>;
}

// ============================================================================
// Infrastructure Providers
// ============================================================================

export interface Logger {
  debug(message: string, context?: string, data?: unknown): void;
  info(message: string, context?: string, data?: unknown): void;
  warn(message: string, context?: string, error?: AppError): void;
  error(message: string, context?: string, error?: AppError): void;
}

export interface GitProvider {
  status(branch?: string): Promise<Result<GitStatus>>;
  pull(branch?: string): Promise<Result<GitPullResult>>;
  commit(message: string, branch?: string): Promise<Result<string>>; // Returns commit hash
  getAllChanges(): Promise<Result<GitFileChange[]>>; // Get staged + unstaged changes
  fetch(remote?: string): Promise<Result<void>>; // Fetch from remote without pulling (network-policy gated)
  getRemoteUrl(remote?: string): Promise<Result<string>>; // Get remote URL for generating diff links
  getCurrentBranch(): Promise<Result<string>>; // Get current branch name
  getHeadCommit(): Promise<Result<string>>; // Full HEAD sha — staleness fingerprint for latest snapshots (ADR 020)
  getRecentCommits(count: number): Promise<Result<RecentCommit[]>>;
  getUntrackedFiles(): Promise<Result<string[]>>;
}

export interface WorkspaceProvider {
  findFiles(pattern: string): Promise<Result<string[]>>;
  readFile(path: string): Promise<Result<string>>;
  /** File size in bytes from metadata — no content read. */
  statFile(path: string): Promise<Result<{ sizeBytes: number }>>;
  deleteFile(path: string): Promise<Result<void>>;
}

// Settings access intentionally bypasses CommandContext — see ADR 013.
// readSetting() in src/infrastructure/settings.ts is the single chokepoint;
// settings are stateless reads, no DI payoff vs the stateful adapters above.

// ============================================================================
// Domain Models & Responses
// ============================================================================

export interface GitStatus {
  branch: string;
  isDirty: boolean;
  staged: number;
  unstaged: number;
  untracked: number;
}

export interface GitPullResult {
  success: boolean;
  branch: string;
  message: string;
}

export interface GitFileChange {
  path: string;
  status: "A" | "M" | "D" | "R"; // Add, Modify, Delete, Rename
  additions: number;
  deletions: number;
}

export interface RecentCommit {
  shortHash: string;
  message: string;
  author: string;
  insertions: number;
  deletions: number;
}

export interface SmartCommitResult {
  success: boolean;
  commits: Array<{
    hash: string;
    message: string;
    files: string[];
  }>;
  totalFiles: number;
  totalGroups: number;
  message?: string;
}

export interface MarkdownFile {
  path: string;
  sizeBytes: number;
  lineCount: number;
}

export interface DeadCodeItem {
  filePath: string;   // absolute path
  line: number;       // 1-based
  character: number;  // 1-based
  message: string;    // TS diagnostic message text
  code: number;       // 6133 | 6192 | 6196 | 6198 | 6199 | 6205
  category: "unusedImport" | "unusedLocal" | "unusedTypeParam";
}

export interface DeadCodeScan {
  items: DeadCodeItem[];
  tsconfigPath: string | null; // null = no tsconfig found (fallback mode)
  durationMs: number;
  fileCount: number;
  error?: string;
}

export interface WorkspaceScan {
  deadFiles: string[];
  largeFiles: Array<{ path: string; sizeBytes: number }>;
  logFiles: string[];
  markdownFiles: MarkdownFile[];
  deadCode: DeadCodeScan;
  /**
   * Heavy-artifact dir buckets (envs/caches/build outputs/vendored deps).
   * Populated by a shallow fs walk (depth ≤ 3) in scan-handler so the
   * sidebar tree taxonomy mirrors the webview Collections section.
   */
  collections: CollectionsBreakdown;
}

/**
 * Heavy-artifact dir buckets surfaced as cleanup targets. Shared between
 * the sidebar (WorkspaceScan.collections) and the webview report
 * (HygieneAnalyticsReport.collections) — same shape, same vocabulary.
 */
export interface CollectionsBreakdown {
  envs: string[];
  caches: string[];
  buildOutputs: string[];
  vendoredDeps: string[];
}

// ============================================================================
// Cross-Cutting Concerns
// ============================================================================

export interface Permission {
  resource: string;
  action: "read" | "write" | "execute";
  allowed: boolean;
}

export interface MiddlewareContext {
  commandName: CommandName;
  userId?: string;
  startTime: number;
  permissions: Permission[];
  runId: string;
  parentRunId?: string;
}

export type Middleware = (
  ctx: MiddlewareContext,
  next: () => Promise<void>
) => Promise<void>;

// ============================================================================
// Prose Generation
// ============================================================================

/**
 * Injectable prose generation function — avoids transitive vscode import in tests.
 * Compatible with generateProse() from infrastructure/prose-generator.
 */
export type GenerateProseFn = (request: {
  domain: "hygiene" | "git";
  systemPrompt: string;
  data: Record<string, unknown>;
}) => Promise<Result<string>>;

// ============================================================================
// Dispatch Lifecycle Events (ADR 008)
// ============================================================================

export interface Disposable {
  dispose(): void;
}

export type Event<T> = (listener: (e: T) => void) => Disposable;

export interface DispatchEvent {
  command: Command;
  context: MiddlewareContext;
}

export interface DispatchCompleteEvent extends DispatchEvent {
  result: Result<unknown>;
}

// ============================================================================
// Run Log Events (Foundation #1)
// ============================================================================

export const RUN_EVENT_SCHEMA_VERSION = 1 as const;
export type RunEventSchemaVersion = typeof RUN_EVENT_SCHEMA_VERSION;

export type RunEventPhase = "start" | "step" | "complete" | "fail";
export type RunEventSource = "router" | "workflow" | "skill";

export interface RunEventBase {
  schemaVersion: RunEventSchemaVersion;
  eventId: string;
  runId: string;
  parentRunId?: string;
  timestampMs: number;
  source: RunEventSource;
  phase: RunEventPhase;
  commandName?: CommandName;
  workflowName?: string;
  skillName?: string;
  stepId?: string;
  attempts?: number;
  timedOut?: boolean;
}

export interface RunStartEvent extends RunEventBase {
  phase: "start";
}

export interface RunStepEvent extends RunEventBase {
  phase: "step";
  stepId: string;
  resultKind: Result<unknown>["kind"];
  errorMessage?: string;
}

export interface RunCompleteEvent extends RunEventBase {
  phase: "complete";
  resultKind: "ok";
  durationMs?: number;
}

export interface RunFailEvent extends RunEventBase {
  phase: "fail";
  resultKind: "err";
  errorCode: string;
  errorMessage: string;
  durationMs?: number;
}

export type RunEventV1 =
  | RunStartEvent
  | RunStepEvent
  | RunCompleteEvent
  | RunFailEvent;

export function isSupportedRunEventVersion(
  version: number
): version is RunEventSchemaVersion {
  return version === RUN_EVENT_SCHEMA_VERSION;
}
