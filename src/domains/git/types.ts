/**
 * Git Domain Types — Smart Commit Grouping, Batch Commits & Inbound Analysis
 */

/**
 * File change metadata extracted from git status/diff
 */
export interface FileChange {
  path: string;
  status: "A" | "M" | "D" | "R"; // Add, Modify, Delete, Rename
  domain: string; // Extracted from path (e.g., "git", "infrastructure", "workflow")
  fileType: string; // File extension (e.g., ".ts", ".md", ".json")
  additions: number;
  deletions: number;
}

/**
 * Suggested commit message components
 */
export type CommitType = "feat" | "fix" | "chore" | "docs" | "refactor";

export interface SuggestedMessage {
  type: CommitType;
  scope: string; // Domain/module scope (e.g., "git", "infrastructure")
  description: string; // Human-readable description
  full: string; // Complete message: "type(scope): description"
}

/**
 * Grouped changes with suggested commit message and similarity score
 */
export interface ChangeGroup {
  id: string;
  files: FileChange[];
  suggestedMessage: SuggestedMessage;
  similarity: number; // 0-1, confidence in grouping
}

/**
 * Commit tracking for rollback
 */
export interface CommitInfo {
  hash: string;
  message: string;
  files: string[];
  timestamp?: number;
}

/**
 * Result of smart commit operation.
 * - commits: one entry per successful group commit (may be empty on failure)
 * - totalFiles/totalGroups: reflect all analyzed changes, not only approved ones
 * - duration: optional timing metadata for telemetry/UX
 */
export interface SmartCommitBatchResult {
  commits: CommitInfo[];
  totalFiles: number;
  totalGroups: number;
  duration?: number;
}

/**
 * Parameters for smartCommit command.
 * - autoApprove: when true, all generated groups are implicitly approved
 *   and the approval UI is skipped entirely (used by workflows, LM tools, chat).
 * - branch: optional logical target branch name; validation is performed in
 *   the handler and GitProvider is responsible for enforcing branch rules.
 */
export interface SmartCommitParams {
  autoApprove?: boolean; // Skip user approval UI
  branch?: string;
}

/** A single approved group with its (possibly user-edited) commit message. */
export interface ApprovalItem {
  group: ChangeGroup;
  approvedMessage: string; // may differ from group.suggestedMessage.full
}

/**
 * Approval UI callback. Receives grouped changes with suggested messages.
 * Returns:
 *   - ApprovalItem[] → approved groups (may be subset, messages may be edited)
 *   - null           → user cancelled the entire flow (Escape)
 */
export type ApprovalUI = (groups: ChangeGroup[]) => Promise<ApprovalItem[] | null>;

// ============================================================================
// PR Generation Types
// ============================================================================

export interface PRGenerationParams {
  targetBranch?: string;  // default: "main"
}

export interface GeneratedPR {
  title: string;
  body: string;
  branch: string;
}

// ============================================================================
// Inbound Changes Analysis Types
// ============================================================================

/**
 * Conflict file with status and severity
 */
export interface ConflictFile {
  path: string;
  localStatus: "M" | "D" | "A"; // What we did
  remoteStatus: "M" | "D" | "A"; // What remote did
  severity: "high" | "medium" | "low";
  localChanges: number; // Our additions/deletions
  remoteChanges: number; // Their additions/deletions
}

/**
 * Summary of inbound changes with recommendations
 */
export interface ChangesSummary {
  description: string; // "3 conflicts in 8 inbound changes"
  conflicts: {
    high: number;
    medium: number;
    low: number;
  };
  fileTypes: Record<string, number>; // ".ts": 5, ".md": 2
  recommendations: string[]; // ["Review conflict in git-provider.ts", ...]
}

/**
 * Result of analyzing inbound changes from remote
 */
export interface InboundChanges {
  remote: string; // "origin"
  branch: string; // "main"
  totalInbound: number; // Files changed remotely
  totalLocal: number; // Files changed locally
  conflicts: ConflictFile[]; // Overlapping changes
  summary: ChangesSummary;
  diffLink: string; // Clickable link to view diff
}

// ============================================================================
// Shared PR Context
// ============================================================================

export interface PRContext {
  branch: string;
  targetBranch: string;
  commits: Array<{ shortHash: string; message: string; author: string; insertions: number; deletions: number }>;
  changes: Array<{ path: string; status: "A" | "M" | "D" | "R"; additions: number; deletions: number }>;
  diff: string;
}

// ============================================================================
// PR Review Types
// ============================================================================

export interface PRReviewParams {
  targetBranch?: string;  // default: "main"
}

export interface PRReviewComment {
  file: string;
  severity: "critical" | "suggestion" | "nit";
  comment: string;
}

export interface GeneratedPRReview {
  branch: string;
  summary: string;
  comments: PRReviewComment[];
  verdict: "approve" | "request-changes" | "comment";
}

// ============================================================================
// PR Comments Types
// ============================================================================

export interface PRCommentParams {
  targetBranch?: string;
  paths?: string[];       // optional filter to specific files
}

export interface InlineComment {
  file: string;
  line?: number;
  comment: string;
}

export interface GeneratedPRComments {
  branch: string;
  comments: InlineComment[];
}

// ============================================================================
// Conflict Resolution Prose Types
// ============================================================================

export interface ConflictResolutionProse {
  overview: string;
  perFile: ConflictResolution[];
}

export interface ConflictResolution {
  path: string;
  strategy: "keep-ours" | "keep-theirs" | "manual-merge" | "review-needed";
  rationale: string;
  suggestedSteps: string[];
}
