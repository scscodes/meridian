import { describe, it, expect } from "vitest";
import { validateWorkflowDefinition } from "../src/domains/workflow/validation";

describe("validateWorkflowDefinition", () => {
  it("accepts valid workflow", () => {
    expect(
      validateWorkflowDefinition({
        name: "deploy",
        steps: [{ id: "s1", command: "git.status", params: {} }],
      })
    ).toBe(true);
  });

  it("rejects null", () => {
    expect(validateWorkflowDefinition(null)).toBe(false);
  });

  it("rejects non-object", () => {
    expect(validateWorkflowDefinition("string")).toBe(false);
  });

  it("rejects missing name", () => {
    expect(
      validateWorkflowDefinition({
        steps: [{ id: "s1", command: "git.status", params: {} }],
      })
    ).toBe(false);
  });

  it("rejects empty name", () => {
    expect(
      validateWorkflowDefinition({
        name: "",
        steps: [{ id: "s1", command: "git.status", params: {} }],
      })
    ).toBe(false);
  });

  it("rejects missing steps", () => {
    expect(validateWorkflowDefinition({ name: "deploy" })).toBe(false);
  });

  it("rejects empty steps array", () => {
    expect(validateWorkflowDefinition({ name: "deploy", steps: [] })).toBe(false);
  });

  it("rejects step without id", () => {
    expect(
      validateWorkflowDefinition({
        name: "deploy",
        steps: [{ command: "git.status", params: {} }],
      })
    ).toBe(false);
  });

  it("rejects step without command", () => {
    expect(
      validateWorkflowDefinition({
        name: "deploy",
        steps: [{ id: "s1", params: {} }],
      })
    ).toBe(false);
  });

  it("rejects step without params", () => {
    expect(
      validateWorkflowDefinition({
        name: "deploy",
        steps: [{ id: "s1", command: "git.status" }],
      })
    ).toBe(false);
  });

  it("accepts multi-step workflow", () => {
    expect(
      validateWorkflowDefinition({
        name: "ci",
        steps: [
          { id: "s1", command: "git.status", params: {} },
          { id: "s2", command: "hygiene.scan", params: { fix: true } },
        ],
      })
    ).toBe(true);
  });
});
