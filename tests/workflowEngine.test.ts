/**
 * WorkflowEngine Tests
 * Testing workflow step execution, branching, variable interpolation,
 * retries, timeouts, and condition evaluation.
 */

import { describe, it, expect, vi } from 'vitest';
import { WorkflowEngine, StepRunner } from '../src/infrastructure/workflow-engine';
import {
  MockLogger,
  createMockContext,
  SAMPLE_WORKFLOW,
  SAMPLE_WORKFLOW_WITH_VARIABLES,
  assertSuccess,
  assertFailure,
} from './fixtures';

describe('WorkflowEngine', () => {
  // Test 1: execute() runs all steps in order
  it('should execute all steps in order', async () => {
    const logger = new MockLogger();
    const executionOrder: string[] = [];

    const stepRunner: StepRunner = async (cmd, ctx) => {
      executionOrder.push(cmd.name);
      return { kind: 'ok' as const, value: {} };
    };

    const engine = new WorkflowEngine(logger, stepRunner);
    const result = await engine.execute(
      SAMPLE_WORKFLOW,
      createMockContext()
    );

    const ctx = assertSuccess(result);

    expect(executionOrder).toEqual(['git.status', 'git.pull']);
    expect(ctx.stepResults.size).toBe(2);
    expect(ctx.stepResults.has('step-1')).toBe(true);
    expect(ctx.stepResults.has('step-2')).toBe(true);
  });

  // Test 2: onSuccess path branches correctly
  it('should follow onSuccess branch path', async () => {
    const logger = new MockLogger();
    const executedSteps: string[] = [];

    const stepRunner: StepRunner = async (cmd, ctx) => {
      executedSteps.push(cmd.name);
      return { kind: 'ok' as const, value: { status: 'success' } };
    };

    const engine = new WorkflowEngine(logger, stepRunner);

    const workflow = {
      name: 'branch-test',
      steps: [
        {
          id: 'step-1',
          command: 'git.status' as const,
          params: {},
          onSuccess: 'step-2',
          onFailure: 'step-3',
        },
        {
          id: 'step-2',
          command: 'git.pull' as const,
          params: {},
          onSuccess: 'exit',
        },
        {
          id: 'step-3',
          command: 'git.commit' as const,
          params: { message: 'fallback' },
          onSuccess: 'exit',
        },
      ],
    };

    const result = await engine.execute(workflow, createMockContext());
    const ctx = assertSuccess(result);

    // Should execute step-1 and step-2, NOT step-3
    expect(executedSteps).toEqual(['git.status', 'git.pull']);
  });

  // Test 3: onFailure path branches correctly
  it('should follow onFailure branch path', async () => {
    const logger = new MockLogger();
    const executedSteps: string[] = [];

    let callCount = 0;
    const stepRunner: StepRunner = async (cmd, ctx) => {
      callCount++;
      executedSteps.push(cmd.name);

      // First call fails, others succeed
      if (callCount === 1) {
        return {
          kind: 'err' as const,
          error: { code: 'FAILED', message: 'Step failed' },
        };
      }
      return { kind: 'ok' as const, value: {} };
    };

    const engine = new WorkflowEngine(logger, stepRunner);

    const workflow = {
      name: 'failure-branch-test',
      steps: [
        {
          id: 'step-1',
          command: 'git.status' as const,
          params: {},
          onSuccess: 'step-2',
          onFailure: 'step-3',
        },
        {
          id: 'step-2',
          command: 'git.pull' as const,
          params: {},
          onSuccess: 'exit',
        },
        {
          id: 'step-3',
          command: 'git.commit' as const,
          params: { message: 'recovery' },
          onSuccess: 'exit',
        },
      ],
    };

    const result = await engine.execute(workflow, createMockContext());
    const ctx = assertSuccess(result);

    // Should execute step-1, skip step-2, execute step-3
    expect(executedSteps).toEqual(['git.status', 'git.commit']);
  });

  // Test 4: variable interpolation works
  it('should interpolate variables in step params', async () => {
    const logger = new MockLogger();
    let capturedParams: any = null;

    const stepRunner: StepRunner = async (cmd, ctx) => {
      capturedParams = cmd.params;
      return { kind: 'ok' as const, value: {} };
    };

    const engine = new WorkflowEngine(logger, stepRunner);

    const workflow = {
      name: 'variable-test',
      steps: [
        {
          id: 'step-1',
          command: 'git.status' as const,
          params: {
            path: '$(srcPath)',
            count: '$(fileCount)',
          },
          onSuccess: 'exit',
        },
      ],
    };

    const variables = {
      srcPath: '/home/user/src',
      fileCount: 42,
    };

    const result = await engine.execute(
      workflow,
      createMockContext(),
      variables
    );

    const ctx = assertSuccess(result);

    expect(capturedParams.path).toBe('/home/user/src');
    // String interpolation converts numbers to strings
    expect(capturedParams.count).toBe('42');
  });

  // Test 5: condition resolution works
  it('should handle nested variable interpolation', async () => {
    const logger = new MockLogger();
    const params: any[] = [];

    const stepRunner: StepRunner = async (cmd, ctx) => {
      params.push(cmd.params);
      return { kind: 'ok' as const, value: { nextStep: 'step-2' } };
    };

    const engine = new WorkflowEngine(logger, stepRunner);

    const workflow = {
      name: 'complex-vars',
      steps: [
        {
          id: 'step-1',
          command: 'git.status' as const,
          params: {
            nested: {
              path: '$(basePath)',
              file: '$(fileName)',
            },
          },
          onSuccess: 'exit',
        },
      ],
    };

    const variables = {
      basePath: '/projects',
      fileName: 'package.json',
    };

    const result = await engine.execute(
      workflow,
      createMockContext(),
      variables
    );

    const ctx = assertSuccess(result);

    expect(params[0].nested.path).toBe('/projects');
    expect(params[0].nested.file).toBe('package.json');
  });

  // ── Retry Tests ──────────────────────────────────────────────────────────

  it('should succeed on 2nd attempt when retry is configured', async () => {
    const logger = new MockLogger();
    let calls = 0;

    const stepRunner: StepRunner = async () => {
      calls++;
      if (calls === 1) {
        return { kind: 'err' as const, error: { code: 'TRANSIENT', message: 'fail' } };
      }
      return { kind: 'ok' as const, value: { recovered: true } };
    };

    const engine = new WorkflowEngine(logger, stepRunner);
    const workflow = {
      name: 'retry-test',
      steps: [{
        id: 's1', command: 'git.pull' as const, params: {},
        onSuccess: 'exit', onFailure: 'exit',
        retry: { maxAttempts: 3, delayMs: 0 },
      }],
    };

    const result = await engine.execute(workflow, createMockContext());
    const ctx = assertSuccess(result);
    const step = ctx.stepResults.get('s1')!;
    expect(step.success).toBe(true);
    expect(step.attempts).toBe(2);
    expect(step.output).toEqual({ recovered: true });
  });

  it('should exhaust all retry attempts and report final error', async () => {
    const logger = new MockLogger();

    const stepRunner: StepRunner = async () => {
      return { kind: 'err' as const, error: { code: 'FAIL', message: 'persistent error' } };
    };

    const engine = new WorkflowEngine(logger, stepRunner);
    const workflow = {
      name: 'retry-exhaust',
      steps: [{
        id: 's1', command: 'git.pull' as const, params: {},
        onSuccess: 'exit', onFailure: 'exit',
        retry: { maxAttempts: 3, delayMs: 0 },
      }],
    };

    const result = await engine.execute(workflow, createMockContext());
    const ctx = assertSuccess(result);
    const step = ctx.stepResults.get('s1')!;
    expect(step.success).toBe(false);
    expect(step.attempts).toBe(3);
    expect(step.error).toBe('persistent error');
  });

  it('should clamp maxAttempts to 1 when set to 0', async () => {
    const logger = new MockLogger();
    let calls = 0;

    const stepRunner: StepRunner = async () => {
      calls++;
      return { kind: 'ok' as const, value: {} };
    };

    const engine = new WorkflowEngine(logger, stepRunner);
    const workflow = {
      name: 'clamp-test',
      steps: [{
        id: 's1', command: 'git.status' as const, params: {},
        onSuccess: 'exit',
        retry: { maxAttempts: 0, delayMs: 0 },
      }],
    };

    await engine.execute(workflow, createMockContext());
    expect(calls).toBe(1);
  });

  it('should cap retry backoff delay at maxDelayMs', async () => {
    const logger = new MockLogger();
    const delays: number[] = [];
    let calls = 0;

    const stepRunner: StepRunner = async () => {
      calls++;
      if (calls <= 3) {
        return { kind: 'err' as const, error: { code: 'FAIL', message: 'fail' } };
      }
      return { kind: 'ok' as const, value: {} };
    };

    const engine = new WorkflowEngine(logger, stepRunner);
    // Spy on delay via logger messages which include the delay value
    const origInfo = logger.info.bind(logger);
    vi.spyOn(logger, 'info').mockImplementation((msg: string, ctx?: string) => {
      const match = msg.match(/after (\d+)ms/);
      if (match) delays.push(Number(match[1]));
      origInfo(msg, ctx);
    });

    const workflow = {
      name: 'backoff-cap',
      steps: [{
        id: 's1', command: 'git.pull' as const, params: {},
        onSuccess: 'exit', onFailure: 'exit',
        retry: { maxAttempts: 4, delayMs: 100, backoffMultiplier: 10, maxDelayMs: 500 },
      }],
    };

    await engine.execute(workflow, createMockContext());
    // Delays: min(100*10^0,500)=100, min(100*10^1,500)=500, min(100*10^2,500)=500
    expect(delays).toEqual([100, 500, 500]);
  });

  // ── Timeout Tests ────────────────────────────────────────────────────────

  it('should fail with timedOut when step exceeds timeout', async () => {
    const logger = new MockLogger();

    const stepRunner: StepRunner = async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return { kind: 'ok' as const, value: {} };
    };

    const engine = new WorkflowEngine(logger, stepRunner);
    const workflow = {
      name: 'timeout-test',
      steps: [{
        id: 's1', command: 'git.pull' as const, params: {},
        onSuccess: 'exit', onFailure: 'exit',
        timeout: 50,
      }],
    };

    const result = await engine.execute(workflow, createMockContext());
    const ctx = assertSuccess(result);
    const step = ctx.stepResults.get('s1')!;
    expect(step.success).toBe(false);
    expect(step.timedOut).toBe(true);
    expect(step.error).toContain('timed out after');
  });

  it('should succeed when step completes within timeout', async () => {
    const logger = new MockLogger();

    const stepRunner: StepRunner = async () => {
      return { kind: 'ok' as const, value: { fast: true } };
    };

    const engine = new WorkflowEngine(logger, stepRunner);
    const workflow = {
      name: 'timeout-ok',
      steps: [{
        id: 's1', command: 'git.status' as const, params: {},
        onSuccess: 'exit',
        timeout: 5000,
      }],
    };

    const result = await engine.execute(workflow, createMockContext());
    const ctx = assertSuccess(result);
    const step = ctx.stepResults.get('s1')!;
    expect(step.success).toBe(true);
    expect(step.timedOut).toBeUndefined();
  });

  it('should not timeout when timeout is undefined', async () => {
    const logger = new MockLogger();

    const stepRunner: StepRunner = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { kind: 'ok' as const, value: {} };
    };

    const engine = new WorkflowEngine(logger, stepRunner);
    const workflow = {
      name: 'no-timeout',
      steps: [{
        id: 's1', command: 'git.status' as const, params: {},
        onSuccess: 'exit',
        // no timeout field
      }],
    };

    const result = await engine.execute(workflow, createMockContext());
    const ctx = assertSuccess(result);
    expect(ctx.stepResults.get('s1')!.success).toBe(true);
  });

  it('should retry after timeout and eventually succeed', async () => {
    const logger = new MockLogger();
    let calls = 0;

    const stepRunner: StepRunner = async () => {
      calls++;
      if (calls === 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      return { kind: 'ok' as const, value: {} };
    };

    const engine = new WorkflowEngine(logger, stepRunner);
    const workflow = {
      name: 'retry-timeout',
      steps: [{
        id: 's1', command: 'git.pull' as const, params: {},
        onSuccess: 'exit', onFailure: 'exit',
        timeout: 50,
        retry: { maxAttempts: 2, delayMs: 0 },
      }],
    };

    const result = await engine.execute(workflow, createMockContext());
    const ctx = assertSuccess(result);
    const step = ctx.stepResults.get('s1')!;
    expect(step.success).toBe(true);
    expect(step.attempts).toBe(2);
  });

  // ── Condition Evaluation Tests ───────────────────────────────────────────

  it('should branch on output condition match', async () => {
    const logger = new MockLogger();
    const executed: string[] = [];

    const stepRunner: StepRunner = async (cmd) => {
      executed.push(cmd.name);
      if (cmd.name === 'git.status') {
        return { kind: 'ok' as const, value: { isDirty: true } };
      }
      return { kind: 'ok' as const, value: {} };
    };

    const engine = new WorkflowEngine(logger, stepRunner);
    const workflow = {
      name: 'condition-output',
      steps: [
        {
          id: 'check', command: 'git.status' as const, params: {},
          onSuccess: 'clean-path', onFailure: 'exit',
          conditions: [
            { type: 'output' as const, key: 'isDirty', value: true, nextStepId: 'dirty-path' },
          ],
        },
        { id: 'clean-path', command: 'git.pull' as const, params: {}, onSuccess: 'exit' },
        { id: 'dirty-path', command: 'git.commit' as const, params: { message: 'auto' }, onSuccess: 'exit' },
      ],
    };

    await engine.execute(workflow, createMockContext());
    expect(executed).toEqual(['git.status', 'git.commit']);
  });

  it('should fall through to onSuccess when no condition matches', async () => {
    const logger = new MockLogger();
    const executed: string[] = [];

    const stepRunner: StepRunner = async (cmd) => {
      executed.push(cmd.name);
      return { kind: 'ok' as const, value: { isDirty: false } };
    };

    const engine = new WorkflowEngine(logger, stepRunner);
    const workflow = {
      name: 'condition-fallthrough',
      steps: [
        {
          id: 'check', command: 'git.status' as const, params: {},
          onSuccess: 'clean-path', onFailure: 'exit',
          conditions: [
            { type: 'output' as const, key: 'isDirty', value: true, nextStepId: 'dirty-path' },
          ],
        },
        { id: 'clean-path', command: 'git.pull' as const, params: {}, onSuccess: 'exit' },
        { id: 'dirty-path', command: 'git.commit' as const, params: { message: 'auto' }, onSuccess: 'exit' },
      ],
    };

    await engine.execute(workflow, createMockContext());
    expect(executed).toEqual(['git.status', 'git.pull']);
  });

  it('should branch on variable condition match', async () => {
    const logger = new MockLogger();
    const executed: string[] = [];

    const stepRunner: StepRunner = async (cmd) => {
      executed.push(cmd.name);
      return { kind: 'ok' as const, value: {} };
    };

    const engine = new WorkflowEngine(logger, stepRunner);
    const workflow = {
      name: 'condition-variable',
      steps: [
        {
          id: 'check', command: 'git.status' as const, params: {},
          onSuccess: 'default-path', onFailure: 'exit',
          conditions: [
            { type: 'variable' as const, key: 'mode', value: 'fast', nextStepId: 'fast-path' },
          ],
        },
        { id: 'default-path', command: 'git.pull' as const, params: {}, onSuccess: 'exit' },
        { id: 'fast-path', command: 'git.commit' as const, params: { message: 'fast' }, onSuccess: 'exit' },
      ],
    };

    await engine.execute(workflow, createMockContext(), { mode: 'fast' });
    expect(executed).toEqual(['git.status', 'git.commit']);
  });

  it('should handle condition with no nextStepId — falls to default', async () => {
    const logger = new MockLogger();
    const executed: string[] = [];

    const stepRunner: StepRunner = async (cmd) => {
      executed.push(cmd.name);
      return { kind: 'ok' as const, value: { status: 'ready' } };
    };

    const engine = new WorkflowEngine(logger, stepRunner);
    const workflow = {
      name: 'condition-no-nextstep',
      steps: [
        {
          id: 'check', command: 'git.status' as const, params: {},
          onSuccess: 'next', onFailure: 'exit',
          conditions: [
            { type: 'output' as const, key: 'status', value: 'ready' },
          ],
        },
        { id: 'next', command: 'git.pull' as const, params: {}, onSuccess: 'exit' },
      ],
    };

    await engine.execute(workflow, createMockContext());
    // Condition matches but has no nextStepId, so falls to onSuccess
    expect(executed).toEqual(['git.status', 'git.pull']);
  });

  it('should handle "env" condition type as alias for "variable"', async () => {
    const logger = new MockLogger();
    const executed: string[] = [];

    const stepRunner: StepRunner = async (cmd) => {
      executed.push(cmd.name);
      return { kind: 'ok' as const, value: {} };
    };

    const engine = new WorkflowEngine(logger, stepRunner);
    const workflow = {
      name: 'condition-env-alias',
      steps: [
        {
          id: 'check', command: 'git.status' as const, params: {},
          onSuccess: 'default-path', onFailure: 'exit',
          conditions: [
            { type: 'env' as const, key: 'env', value: 'prod', nextStepId: 'prod-path' },
          ],
        },
        { id: 'default-path', command: 'git.pull' as const, params: {}, onSuccess: 'exit' },
        { id: 'prod-path', command: 'git.commit' as const, params: {}, onSuccess: 'exit' },
      ],
    };

    await engine.execute(workflow, createMockContext(), { env: 'prod' });
    expect(executed).toEqual(['git.status', 'git.commit']);
  });
});
