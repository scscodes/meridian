/**
 * Workflow Validation — pure schema validation for WorkflowDefinition.
 *
 * Extracted from workflow/service.ts for independent testability.
 */

import { WorkflowDefinition } from "../../types";

/**
 * Validate workflow definition schema.
 */
export function validateWorkflowDefinition(
  data: unknown
): data is WorkflowDefinition {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Required fields
  if (typeof obj.name !== "string" || !obj.name) {
    return false;
  }

  if (!Array.isArray(obj.steps) || obj.steps.length === 0) {
    return false;
  }

  // Validate each step
  for (const step of obj.steps as unknown[]) {
    if (typeof step !== "object" || step === null) {
      return false;
    }

    const stepObj = step as Record<string, unknown>;
    if (typeof stepObj.id !== "string" || !stepObj.id) {
      return false;
    }

    if (typeof stepObj.command !== "string" || !stepObj.command) {
      return false;
    }

    if (typeof stepObj.params !== "object") {
      return false;
    }
  }

  return true;
}
