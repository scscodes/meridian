import type { ITool, ToolId, ScanOptions, ScanResult, ExportFormat } from '../../types/index.js';

/**
 * Auto-Commit tool.
 *
 * Strategy:
 * 1. Detect changed files in the working tree (git status)
 * 2. Auto-stage changed files (or work with already-staged files)
 * 3. Generate a commit message using the model, respecting CommitConstraints
 * 4. Validate against constraints — warn or deny based on settings
 * 5. Dry-run pre-commit hooks if configured
 * 6. Present CommitProposal for user approval — never auto-commit
 *
 * The ScanResult for this tool is a bit different — the "findings" represent
 * changed files, and the proposal is in metadata. See types/git.ts.
 */
export class CommitTool implements ITool {
  readonly id: ToolId = 'commit';
  readonly name = 'Auto-Commit';
  readonly description = 'Stage changed files and generate a commit message for approval.';

  private abortController?: AbortController;

  async execute(_options: ScanOptions): Promise<ScanResult> {
    // TODO: Phase 1 — detect changed files
    // TODO: Phase 2 — auto-stage
    // TODO: Phase 3 — generate commit message via model
    // TODO: Phase 4 — validate constraints
    // TODO: Phase 5 — dry-run pre-commit hooks
    // TODO: Phase 6 — assemble CommitProposal
    throw new Error('CommitTool.execute not yet implemented');
  }

  cancel(): void {
    this.abortController?.abort();
  }

  export(_result: ScanResult, _format: ExportFormat): string {
    throw new Error('CommitTool.export not yet implemented');
  }
}
