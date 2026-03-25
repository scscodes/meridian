/**
 * Workflow Engine — execute workflow steps linearly with conditional branching.
 * Supports output passing between steps and error recovery.
 */

import { Logger, Result, failure, success, Command, CommandContext } from "../types";
import { WorkflowCondition, WorkflowDefinition, WorkflowStep } from "../types";

/**
 * Step execution result includes output for conditional branching.
 */
export interface StepExecutionResult {
  stepId: string;
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  nextStepId?: string; // Resolved next step based on conditions
  attempts?: number; // Total attempts executed (>1 means retries occurred)
  timedOut?: boolean; // True if final failure was a timeout
}

/**
 * Workflow execution context tracking state across steps.
 */
export interface WorkflowExecutionContext {
  workflowName: string;
  currentStepId: string;
  stepResults: Map<string, StepExecutionResult>; // Track all step outputs
  startTime: number;
  variables: Record<string, unknown>; // Shared state across steps
}

/**
 * Step runner function signature — execute single step.
 * Provided by router; calls command handler.
 */
export type StepRunner = (
  stepCommand: Command,
  commandContext: CommandContext
) => Promise<Result<Record<string, unknown>>>;

/**
 * Workflow engine — orchestrate step execution.
 */
export class WorkflowEngine {
  constructor(
    private logger: Logger,
    private stepRunner: StepRunner
  ) {}

  /**
   * Execute workflow definition linearly.
   */
  async execute(
    workflow: WorkflowDefinition,
    commandContext: CommandContext,
    variables: Record<string, unknown> = {}
  ): Promise<Result<WorkflowExecutionContext>> {
    const executionCtx: WorkflowExecutionContext = {
      workflowName: workflow.name,
      currentStepId: workflow.steps[0]?.id || "exit",
      stepResults: new Map(),
      startTime: Date.now(),
      variables,
    };

    try {
      let stepIndex = 0;

      while (stepIndex < workflow.steps.length) {
        const step = workflow.steps[stepIndex];
        executionCtx.currentStepId = step.id;

        // Execute step
        const stepResult = await this.executeStep(
          step,
          commandContext,
          executionCtx
        );
        executionCtx.stepResults.set(step.id, stepResult);

        this.logger.info(
          `Step ${step.id} completed: ${stepResult.success ? "success" : "failure"}`,
          "WorkflowEngine.execute"
        );

        // Resolve next step based on conditions
        const nextStepId = stepResult.nextStepId || this.resolveNextStep(step, stepResult, executionCtx);
        if (!nextStepId || nextStepId === "exit") {
          break;
        }

        // Find next step in workflow
        const nextStepIndex = workflow.steps.findIndex((s) => s.id === nextStepId);
        if (nextStepIndex === -1) {
          return failure({
            code: "INVALID_NEXT_STEP",
            message: `Step ${step.id} references undefined next step: ${nextStepId}`,
            context: "WorkflowEngine.execute",
          });
        }

        stepIndex = nextStepIndex;
      }

      return success(executionCtx);
    } catch (err) {
      this.logger.error(
        `Workflow execution failed`,
        "WorkflowEngine.execute",
        { error: err, currentStep: executionCtx.currentStepId } as any
      );

      return failure({
        code: "WORKFLOW_EXECUTION_ERROR",
        message: `Workflow ${workflow.name} failed at step ${executionCtx.currentStepId}`,
        details: err,
        context: "WorkflowEngine.execute",
      });
    }
  }

  /**
   * Execute single workflow step with retry and timeout support.
   */
  private async executeStep(
    step: WorkflowStep,
    commandContext: CommandContext,
    executionCtx: WorkflowExecutionContext
  ): Promise<StepExecutionResult> {
    const params = this.interpolateParams(step.params, executionCtx.variables);
    const command: Command = { name: step.command, params };

    const maxAttempts = Math.max(1, step.retry?.maxAttempts ?? 1);
    const delayMs = Math.max(0, step.retry?.delayMs ?? 1000);
    const multiplier = step.retry?.backoffMultiplier ?? 2;
    const maxDelay = step.retry?.maxDelayMs ?? 5000;
    const timeoutMs = step.timeout;

    let lastError: string | undefined;
    let lastTimedOut = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const runnerPromise = this.stepRunner(command, commandContext);
        const result = timeoutMs != null && timeoutMs > 0
          ? await this.withTimeout(runnerPromise, timeoutMs)
          : await runnerPromise;

        if (result.kind === "ok") {
          return {
            stepId: step.id,
            success: true,
            output: result.value,
            attempts: attempt,
          };
        }

        lastError = result.error.message;
        lastTimedOut = false;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        lastTimedOut = msg.includes("timed out after");
        lastError = msg;
      }

      if (attempt < maxAttempts) {
        const backoff = Math.min(delayMs * multiplier ** (attempt - 1), maxDelay);
        this.logger.info(
          `Retrying step ${step.id} (attempt ${attempt + 1}/${maxAttempts}) after ${backoff}ms`,
          "WorkflowEngine.executeStep"
        );
        await this.delay(backoff);
      }
    }

    return {
      stepId: step.id,
      success: false,
      error: lastError,
      attempts: maxAttempts,
      timedOut: lastTimedOut,
    };
  }

  /**
   * Resolve next step — evaluate conditions first, fall back to onSuccess/onFailure.
   */
  private resolveNextStep(
    step: WorkflowStep,
    result: StepExecutionResult,
    executionCtx: WorkflowExecutionContext
  ): string | undefined {
    if (step.conditions?.length) {
      for (const condition of step.conditions) {
        if (this.evaluateCondition(condition, result, executionCtx)) {
          return condition.nextStepId ?? (result.success ? step.onSuccess : step.onFailure);
        }
      }
    }
    return result.success ? step.onSuccess : step.onFailure;
  }

  /**
   * Evaluate a single workflow condition against step result and execution state.
   */
  private evaluateCondition(
    condition: WorkflowCondition,
    result: StepExecutionResult,
    executionCtx: WorkflowExecutionContext
  ): boolean {
    switch (condition.type) {
      case "success":
        return result.success;
      case "failure":
        return !result.success;
      case "output":
        return condition.key != null && result.output?.[condition.key] === condition.value;
      case "variable":
      case "env":
        return condition.key != null && executionCtx.variables[condition.key] === condition.value;
      default:
        return false;
    }
  }

  /**
   * Race a promise against a timeout.
   */
  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Step timed out after ${ms}ms`)),
        ms
      );
      promise.then(
        (v) => { clearTimeout(timer); resolve(v); },
        (e) => { clearTimeout(timer); reject(e); }
      );
    });
  }

  /**
   * Delay helper for retry backoff.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Interpolate variables in step params.
   * Example: { path: "$(srcPath)" } → { path: "/home/user/src" }
   */
  private interpolateParams(
    params: Record<string, unknown>,
    variables: Record<string, unknown>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") {
        result[key] = this.interpolateString(value, variables);
      } else if (typeof value === "object" && value !== null) {
        result[key] = this.interpolateParams(
          value as Record<string, unknown>,
          variables
        );
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Interpolate single string with variables.
   */
  private interpolateString(
    value: string,
    variables: Record<string, unknown>
  ): string {
    return value.replace(/\$\(([^)]+)\)/g, (_, varName) => {
      return String(variables[varName] ?? `$(${varName})`);
    });
  }
}
