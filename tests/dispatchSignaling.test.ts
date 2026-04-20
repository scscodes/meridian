/**
 * Dispatch signaling tests — verifies that registerDispatchSignaling
 * wires router lifecycle events to tree-provider state methods.
 */

import { describe, it, expect, vi } from 'vitest';
import { CommandRouter } from '../src/router';
import { MockLogger, createMockContext } from './fixtures';
import { registerDispatchSignaling } from '../src/presentation/dispatch-signaling';
import type { WorkflowTreeProvider } from '../src/ui/tree-providers/workflow-tree-provider';
import type { GitTreeProvider } from '../src/ui/tree-providers/git-tree-provider';

function makeTrees() {
  const workflowTree = {
    setRunning: vi.fn(),
    setLastRun: vi.fn(),
  } as unknown as WorkflowTreeProvider;
  const gitTree = {
    setConflictRunning: vi.fn(),
    setLastConflictRun: vi.fn(),
  } as unknown as GitTreeProvider;
  return { workflowTree, gitTree };
}

describe('dispatch-signaling', () => {
  it('workflow.run onBefore → workflowTree.setRunning with workflow name', async () => {
    const logger = new MockLogger();
    const router = new CommandRouter(logger);
    const trees = makeTrees();
    registerDispatchSignaling(router, trees, logger);

    router.registerDomain({
      name: 'sig-wf-before',
      handlers: {
        'workflow.run': async () => ({ kind: 'ok' as const, value: { success: true, duration: 100, stepResults: [], workflowName: 'deploy', stepCount: 1 } }),
      },
    });

    await router.dispatch({ name: 'workflow.run', params: { name: 'deploy' } }, createMockContext());

    expect(trees.workflowTree.setRunning).toHaveBeenCalledWith('deploy');
  });

  it('workflow.run onAfter success → workflowTree.setLastRun with parsed result', async () => {
    const logger = new MockLogger();
    const router = new CommandRouter(logger);
    const trees = makeTrees();
    registerDispatchSignaling(router, trees, logger);

    const okValue = { success: true, duration: 250, stepResults: [{ stepId: 's1', success: true, attempts: 1 }], workflowName: 'deploy', stepCount: 1 };
    router.registerDomain({
      name: 'sig-wf-after-ok',
      handlers: {
        'workflow.run': async () => ({ kind: 'ok' as const, value: okValue }),
      },
    });

    await router.dispatch({ name: 'workflow.run', params: { name: 'deploy' } }, createMockContext());

    expect(trees.workflowTree.setLastRun).toHaveBeenCalledWith('deploy', true, 250, okValue.stepResults);
  });

  it('workflow.run onAfter failure → workflowTree.setLastRun with defaults', async () => {
    const logger = new MockLogger();
    const router = new CommandRouter(logger);
    const trees = makeTrees();
    registerDispatchSignaling(router, trees, logger);

    router.registerDomain({
      name: 'sig-wf-after-fail',
      handlers: {
        'workflow.run': async () => { throw new Error('fail'); },
      },
    });

    await router.dispatch({ name: 'workflow.run', params: { name: 'deploy' } }, createMockContext());

    expect(trees.workflowTree.setLastRun).toHaveBeenCalledWith('deploy', false, 0, []);
  });

  it('git.resolveConflicts onBefore → gitTree.setConflictRunning', async () => {
    const logger = new MockLogger();
    const router = new CommandRouter(logger);
    const trees = makeTrees();
    registerDispatchSignaling(router, trees, logger);

    router.registerDomain({
      name: 'sig-git-before',
      handlers: {
        'git.resolveConflicts': async () => ({ kind: 'ok' as const, value: null }),
      },
    });

    await router.dispatch({ name: 'git.resolveConflicts', params: {} }, createMockContext());

    expect(trees.gitTree.setConflictRunning).toHaveBeenCalledOnce();
  });

  it('git.resolveConflicts onAfter → gitTree.setLastConflictRun', async () => {
    const logger = new MockLogger();
    const router = new CommandRouter(logger);
    const trees = makeTrees();
    registerDispatchSignaling(router, trees, logger);

    router.registerDomain({
      name: 'sig-git-after',
      handlers: {
        'git.resolveConflicts': async () => ({ kind: 'ok' as const, value: { summary: 'ok' } as any }),
      },
    });

    await router.dispatch({ name: 'git.resolveConflicts', params: {} }, createMockContext());

    expect(trees.gitTree.setLastConflictRun).toHaveBeenCalled();
  });

  it('non-tracked commands do not touch any tree', async () => {
    const logger = new MockLogger();
    const router = new CommandRouter(logger);
    const trees = makeTrees();
    registerDispatchSignaling(router, trees, logger);

    router.registerDomain({
      name: 'sig-untracked',
      handlers: {
        'git.status': async () => ({ kind: 'ok' as const, value: {} }),
      },
    });

    await router.dispatch({ name: 'git.status', params: {} }, createMockContext());

    expect(trees.workflowTree.setRunning).not.toHaveBeenCalled();
    expect(trees.workflowTree.setLastRun).not.toHaveBeenCalled();
    expect(trees.gitTree.setConflictRunning).not.toHaveBeenCalled();
    expect(trees.gitTree.setLastConflictRun).not.toHaveBeenCalled();
  });
});
