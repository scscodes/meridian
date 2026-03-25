/**
 * Workflow domain types and interfaces.
 */

/**
 * Result of listing workflows.
 */
export interface ListWorkflowsResult {
  workflows: WorkflowInfo[];
  count: number;
}

/**
 * Workflow information summary.
 */
export interface WorkflowInfo {
  name: string;
  description?: string;
  version?: string;
  stepCount: number;
}

/**
 * Per-step execution summary included in RunWorkflowResult.
 */
export interface StepResult {
  stepId: string;
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  attempts?: number; // Total attempts executed (>1 means retries occurred)
  timedOut?: boolean; // True if final failure was a timeout
}

/**
 * Result of running a workflow.
 */
export interface RunWorkflowResult {
  workflowName: string;
  success: boolean;           // false if any step reported failure
  duration: number;           // milliseconds
  stepCount: number;
  failedAt?: string;          // Step ID of first failing step
  message: string;
  stepResults: StepResult[];  // Ordered by workflow step sequence
}
