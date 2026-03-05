/**
 * Workflow Handlers Tests — workflow.list and workflow.run
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockLogger, createMockContext } from './fixtures';
import {
  createListWorkflowsHandler,
  createRunWorkflowHandler,
} from '../src/domains/workflow/handlers';
import { success, failure } from '../src/types';
import type { WorkflowDefinition } from '../src/types';

// ---- helpers ----

function makeWorkflow(overrides?: Partial<WorkflowDefinition>): WorkflowDefinition {
  return {
    name: 'deploy-pipeline',
    description: 'Continuous deployment workflow',
    version: '1.0.0',
    steps: [
      { id: 'step-1', command: 'git.status' as any, params: {}, onSuccess: 'step-2', onFailure: 'exit' },
      { id: 'step-2', command: 'git.pull' as any, params: {}, onSuccess: 'exit', onFailure: 'exit' },
    ],
    ...overrides,
  };
}

// ============================================================
// workflow.list
// ============================================================

describe('workflow.list', () => {
  let logger: MockLogger;
  const discoverWorkflows = vi.fn<() => Map<string, WorkflowDefinition>>();

  beforeEach(() => {
    logger = new MockLogger();
    discoverWorkflows.mockReset();
  });

  it('returns empty list when no workflows discovered', async () => {
    discoverWorkflows.mockReturnValue(new Map());

    const handler = createListWorkflowsHandler(logger, discoverWorkflows);
    const result = await handler(createMockContext(), {});

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.workflows).toEqual([]);
      expect(result.value.count).toBe(0);
    }
  });

  it('returns populated workflow list with name, description, and stepCount', async () => {
    const wf1 = makeWorkflow({ name: 'deploy', description: 'Deploy to prod', version: '2.0' });
    const wf2 = makeWorkflow({
      name: 'lint-fix',
      description: 'Run linter and auto-fix',
      steps: [{ id: 's1', command: 'git.status' as any, params: {}, onSuccess: 'exit', onFailure: 'exit' }],
    });

    const map = new Map<string, WorkflowDefinition>([
      ['deploy', wf1],
      ['lint-fix', wf2],
    ]);
    discoverWorkflows.mockReturnValue(map);

    const handler = createListWorkflowsHandler(logger, discoverWorkflows);
    const result = await handler(createMockContext(), {});

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.count).toBe(2);
      expect(result.value.workflows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'deploy', description: 'Deploy to prod', stepCount: 2 }),
          expect.objectContaining({ name: 'lint-fix', description: 'Run linter and auto-fix', stepCount: 1 }),
        ])
      );
    }
  });

  it('returns WORKFLOW_LIST_ERROR when discoverWorkflows throws', async () => {
    discoverWorkflows.mockImplementation(() => {
      throw new Error('filesystem unavailable');
    });

    const handler = createListWorkflowsHandler(logger, discoverWorkflows);
    const result = await handler(createMockContext(), {});

    expect(result.kind).toBe('err');
    if (result.kind === 'err') {
      expect(result.error.code).toBe('WORKFLOW_LIST_ERROR');
    }
  });
});

// ============================================================
// workflow.run
// ============================================================

describe('workflow.run', () => {
  let logger: MockLogger;
  const loadWorkflow = vi.fn<(name: string) => WorkflowDefinition | null>();
  const mockEngine = { execute: vi.fn() };
  const getWorkflowEngine = () => mockEngine as any;

  beforeEach(() => {
    logger = new MockLogger();
    loadWorkflow.mockReset();
    mockEngine.execute.mockReset();
  });

  it('returns INVALID_PARAMS when name is empty', async () => {
    const handler = createRunWorkflowHandler(logger, getWorkflowEngine, loadWorkflow);
    const result = await handler(createMockContext(), { name: '' } as any);

    expect(result.kind).toBe('err');
    if (result.kind === 'err') {
      expect(result.error.code).toBe('INVALID_PARAMS');
    }
  });

  it('returns WORKFLOW_NOT_FOUND when loadWorkflow returns null', async () => {
    loadWorkflow.mockReturnValue(null);

    const handler = createRunWorkflowHandler(logger, getWorkflowEngine, loadWorkflow);
    const result = await handler(createMockContext(), { name: 'nonexistent' } as any);

    expect(result.kind).toBe('err');
    if (result.kind === 'err') {
      expect(result.error.code).toBe('WORKFLOW_NOT_FOUND');
      expect(result.error.message).toContain('nonexistent');
    }
  });

  it('returns success result when engine succeeds', async () => {
    const wf = makeWorkflow({ name: 'my-flow' });
    loadWorkflow.mockReturnValue(wf);
    mockEngine.execute.mockResolvedValue(success({ completed: true }));

    const handler = createRunWorkflowHandler(logger, getWorkflowEngine, loadWorkflow);
    const result = await handler(createMockContext(), { name: 'my-flow' } as any);

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.workflowName).toBe('my-flow');
      expect(result.value.success).toBe(true);
      expect(result.value.stepCount).toBe(2);
      expect(typeof result.value.duration).toBe('number');
    }
  });

  it('returns WORKFLOW_EXECUTION_FAILED when engine returns failure', async () => {
    const wf = makeWorkflow({ name: 'broken-flow' });
    loadWorkflow.mockReturnValue(wf);
    mockEngine.execute.mockResolvedValue(
      failure({
        code: 'STEP_EXECUTION_ERROR',
        message: 'step timed out',
        details: { currentStep: 'step-2' },
      })
    );

    const handler = createRunWorkflowHandler(logger, getWorkflowEngine, loadWorkflow);
    const result = await handler(createMockContext(), { name: 'broken-flow' } as any);

    expect(result.kind).toBe('err');
    if (result.kind === 'err') {
      expect(result.error.code).toBe('WORKFLOW_EXECUTION_FAILED');
      expect(result.error.details).toEqual(
        expect.objectContaining({
          failedAt: 'step-2',
          stepCount: 2,
        })
      );
    }
  });

  it('returns WORKFLOW_RUN_ERROR when engine throws', async () => {
    const wf = makeWorkflow({ name: 'crash-flow' });
    loadWorkflow.mockReturnValue(wf);
    mockEngine.execute.mockRejectedValue(new Error('engine exploded'));

    const handler = createRunWorkflowHandler(logger, getWorkflowEngine, loadWorkflow);
    const result = await handler(createMockContext(), { name: 'crash-flow' } as any);

    expect(result.kind).toBe('err');
    if (result.kind === 'err') {
      expect(result.error.code).toBe('WORKFLOW_RUN_ERROR');
    }
  });

  it('passes variables through to engine.execute', async () => {
    const wf = makeWorkflow({ name: 'var-flow' });
    loadWorkflow.mockReturnValue(wf);
    mockEngine.execute.mockResolvedValue(success({ done: true }));

    const variables = { srcPath: '/home/user/project', branch: 'develop' };

    const handler = createRunWorkflowHandler(logger, getWorkflowEngine, loadWorkflow);
    const ctx = createMockContext();
    await handler(ctx, { name: 'var-flow', variables } as any);

    expect(mockEngine.execute).toHaveBeenCalledWith(wf, ctx, variables);
  });
});
