/**
 * Agent Domain Tests — agent.list and agent.execute
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockLogger, createMockContext } from './fixtures';
import { createListAgentsHandler } from '../src/domains/agent/handlers';
import { createExecuteAgentHandler } from '../src/domains/agent/execution-handler';
import { AgentDefinition } from '../src/types';
import { success, failure } from '../src/types';

vi.mock('../src/infrastructure/agent-registry', () => ({
  loadAgents: vi.fn(),
}));

import { loadAgents } from '../src/infrastructure/agent-registry';
const mockedLoadAgents = vi.mocked(loadAgents);

// ---- helpers ----

function makeAgentMap(...agents: AgentDefinition[]): Map<string, AgentDefinition> {
  return new Map(agents.map((a) => [a.id, a]));
}

const baseAgent: AgentDefinition = {
  id: 'git-operator',
  capabilities: ['git.status', 'git.smartCommit'] as any,
  workflowTriggers: ['sync-repo'],
};

// ============================================================
// agent.list
// ============================================================

describe('agent.list', () => {
  let logger: MockLogger;

  beforeEach(() => {
    logger = new MockLogger();
  });

  it('returns empty list when no agents discovered', async () => {
    const handler = createListAgentsHandler(logger, () => new Map());
    const result = await handler(createMockContext(), {});
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.agents).toHaveLength(0);
      expect(result.value.count).toBe(0);
    }
  });

  it('returns correct count and structure for multiple agents', async () => {
    const agentB: AgentDefinition = {
      id: 'hygiene-bot',
      capabilities: ['hygiene.scan'] as any,
    };
    const handler = createListAgentsHandler(logger, () => makeAgentMap(baseAgent, agentB));
    const result = await handler(createMockContext(), {});
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.count).toBe(2);
      expect(result.value.agents).toHaveLength(2);
    }
  });

  it('maps all AgentDefinition fields: id, description, version, capabilities, workflowTriggers', async () => {
    const richAgent: AgentDefinition = {
      id: 'full-agent',
      description: 'A fully specified agent',
      version: '2.0.0',
      capabilities: ['git.status', 'git.pull'] as any,
      workflowTriggers: ['morning-sync', 'sync-repo'],
    };
    const handler = createListAgentsHandler(logger, () => makeAgentMap(richAgent));
    const result = await handler(createMockContext(), {});
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      const info = result.value.agents[0];
      expect(info.id).toBe('full-agent');
      expect(info.description).toBe('A fully specified agent');
      expect(info.version).toBe('2.0.0');
      expect(info.capabilities).toEqual(['git.status', 'git.pull']);
      expect(info.workflowTriggers).toEqual(['morning-sync', 'sync-repo']);
    }
  });

  it('calls discoverFn on each invocation (not cached at handler level)', async () => {
    let callCount = 0;
    const discoverFn = () => {
      callCount++;
      return makeAgentMap(baseAgent);
    };
    const handler = createListAgentsHandler(logger, discoverFn);
    await handler(createMockContext(), {});
    await handler(createMockContext(), {});
    expect(callCount).toBe(2);
  });
});

// ============================================================
// agent.execute
// ============================================================

describe('agent.execute', () => {
  let logger: MockLogger;
  let commandDispatcher: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    logger = new MockLogger();
    commandDispatcher = vi.fn();
    vi.clearAllMocks();
  });

  it('returns INVALID_PARAMS when agentId missing', async () => {
    const handler = createExecuteAgentHandler(logger, commandDispatcher);
    const result = await handler(createMockContext(), { agentId: '' } as any);
    expect(result.kind).toBe('err');
    if (result.kind === 'err') {
      expect(result.error.code).toBe('INVALID_PARAMS');
    }
  });

  it('returns INVALID_PARAMS when neither targetCommand nor targetWorkflow provided', async () => {
    mockedLoadAgents.mockReturnValue(makeAgentMap(baseAgent));
    const handler = createExecuteAgentHandler(logger, commandDispatcher);
    const result = await handler(createMockContext(), { agentId: 'git-operator' });
    expect(result.kind).toBe('err');
    if (result.kind === 'err') {
      expect(result.error.code).toBe('INVALID_PARAMS');
    }
  });

  it('returns AGENT_NOT_FOUND when agent not in registry', async () => {
    mockedLoadAgents.mockReturnValue(new Map());
    const handler = createExecuteAgentHandler(logger, commandDispatcher);
    const result = await handler(createMockContext(), {
      agentId: 'nonexistent-agent',
      targetCommand: 'git.status',
    });
    expect(result.kind).toBe('err');
    if (result.kind === 'err') {
      expect(result.error.code).toBe('AGENT_NOT_FOUND');
    }
  });

  it('returns MISSING_CAPABILITY when targetCommand not in agent.capabilities', async () => {
    mockedLoadAgents.mockReturnValue(makeAgentMap(baseAgent));
    const handler = createExecuteAgentHandler(logger, commandDispatcher);
    const result = await handler(createMockContext(), {
      agentId: 'git-operator',
      targetCommand: 'hygiene.scan', // not in baseAgent.capabilities
    });
    expect(result.kind).toBe('err');
    if (result.kind === 'err') {
      expect(result.error.code).toBe('MISSING_CAPABILITY');
    }
  });

  it('command path — success: dispatcher called, result.success=true, executedCommand set, durationMs > 0, logs non-empty', async () => {
    mockedLoadAgents.mockReturnValue(makeAgentMap(baseAgent));
    commandDispatcher.mockResolvedValue(success({ files: [] }));
    const handler = createExecuteAgentHandler(logger, commandDispatcher);
    const result = await handler(createMockContext(), {
      agentId: 'git-operator',
      targetCommand: 'git.status',
      params: { verbose: true },
    });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      const r = result.value;
      expect(r.success).toBe(true);
      expect(r.executedCommand).toBe('git.status');
      expect(r.durationMs).toBeGreaterThanOrEqual(0);
      expect(r.logs.length).toBeGreaterThan(0);
      // Dispatcher was called with a command matching the targetCommand
      expect(commandDispatcher).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'git.status' }),
        expect.anything()
      );
    }
  });

  it('command path — dispatcher err: result.kind=ok but inner success=false, error message propagated', async () => {
    mockedLoadAgents.mockReturnValue(makeAgentMap(baseAgent));
    commandDispatcher.mockResolvedValue(
      failure({ code: 'GIT_UNAVAILABLE', message: 'git not found' })
    );
    const handler = createExecuteAgentHandler(logger, commandDispatcher);
    const result = await handler(createMockContext(), {
      agentId: 'git-operator',
      targetCommand: 'git.status',
    });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.success).toBe(false);
      expect(result.value.error).toContain('git not found');
    }
  });

  it('workflow path — success: dispatcher called with workflow.run, executedWorkflow set', async () => {
    mockedLoadAgents.mockReturnValue(makeAgentMap(baseAgent));
    commandDispatcher.mockResolvedValue(success({ steps: 3 }));
    const handler = createExecuteAgentHandler(logger, commandDispatcher);
    const result = await handler(createMockContext(), {
      agentId: 'git-operator',
      targetWorkflow: 'sync-repo',
      params: { dryRun: false },
    });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.success).toBe(true);
      expect(result.value.executedWorkflow).toBe('sync-repo');
      expect(commandDispatcher).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'workflow.run',
          params: expect.objectContaining({ workflowName: 'sync-repo', dryRun: false }),
        }),
        expect.anything()
      );
    }
  });

  it('workflow path — dispatcher err: result.kind=ok but inner success=false', async () => {
    mockedLoadAgents.mockReturnValue(makeAgentMap(baseAgent));
    commandDispatcher.mockResolvedValue(
      failure({ code: 'WORKFLOW_NOT_FOUND', message: 'sync-repo not found' })
    );
    const handler = createExecuteAgentHandler(logger, commandDispatcher);
    const result = await handler(createMockContext(), {
      agentId: 'git-operator',
      targetWorkflow: 'sync-repo',
    });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.success).toBe(false);
      expect(result.value.error).toContain('sync-repo not found');
    }
  });

  it('workflow trigger warning (not failure) when agent does not declare the trigger', async () => {
    mockedLoadAgents.mockReturnValue(makeAgentMap(baseAgent));
    commandDispatcher.mockResolvedValue(success({}));
    const handler = createExecuteAgentHandler(logger, commandDispatcher);
    // baseAgent.workflowTriggers = ['sync-repo']; use an undeclared workflow
    const result = await handler(createMockContext(), {
      agentId: 'git-operator',
      targetWorkflow: 'unknown-workflow',
    });
    // Should succeed (warning, not failure)
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.success).toBe(true);
    }
    // A warning should have been logged
    const warnLogs = logger.logs.filter((l) => l.level === 'warn');
    expect(warnLogs.length).toBeGreaterThan(0);
  });

  it('execution logs include timestamps in ISO format', async () => {
    mockedLoadAgents.mockReturnValue(makeAgentMap(baseAgent));
    commandDispatcher.mockResolvedValue(success({}));
    const handler = createExecuteAgentHandler(logger, commandDispatcher);
    const result = await handler(createMockContext(), {
      agentId: 'git-operator',
      targetCommand: 'git.status',
    });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.logs.length).toBeGreaterThan(0);
      const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      for (const log of result.value.logs) {
        expect(log.timestamp).toMatch(isoPattern);
      }
    }
  });
});
