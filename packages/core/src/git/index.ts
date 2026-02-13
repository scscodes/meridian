// Executor
export { execGit, execGitStrict, isGitRepo, getRepoRoot } from './executor.js';
export type { GitExecOptions, GitExecResult } from './executor.js';

// Status
export { getChangedFiles, getStagedFiles, getUnstagedFiles, parsePorcelainLine } from './status.js';

// Log
export { getLog, getCommitCount, parseLogOutput } from './log.js';
export type { GitLogEntry, GitLogOptions } from './log.js';

// Blame
export { getBlame, getFileAge, parseBlameOutput } from './blame.js';
export type { BlameRange, BlameOptions } from './blame.js';

// Staging & Commit
export {
  stageFiles,
  stageAll,
  unstageFiles,
  createCommit,
  getDiffSummary,
  getStagedDiff,
  autoStage,
  amendCommit,
  getLastCommitInfo,
} from './staging.js';
export type { LastCommitInfo } from './staging.js';

// Branch
export {
  getCurrentBranch,
  getTrackingBranch,
  getAheadBehind,
  fetchRemote,
  getRemoteDiff,
  getRemoteDiffSummary,
  getRemoteLog,
} from './branch.js';
export type { AheadBehind } from './branch.js';

// Conflicts
export {
  isInMergeState,
  isInConflictState,
  getConflictFiles,
  parseConflictMarkers,
  readConflictFile,
  writeResolution,
} from './conflicts.js';

// Hooks
export { checkHooks } from './hooks.js';

// Validation
export { validateCommitMessage } from './validation.js';
