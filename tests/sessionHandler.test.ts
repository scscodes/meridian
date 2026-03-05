/**
 * Session Briefing Handler Tests — git.sessionBriefing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockGitProvider, MockLogger, createMockContext, createMockChange } from './fixtures';
import { createSessionBriefingHandler } from '../src/domains/git/session-handler';
import { success, failure } from '../src/types';

describe('git.sessionBriefing', () => {
  let git: MockGitProvider;
  let logger: MockLogger;
  let generateProseFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    git = new MockGitProvider();
    logger = new MockLogger();
    generateProseFn = vi.fn();

    // Default happy-path stubs
    git.setStatus({ branch: 'develop', isDirty: true, staged: 2, unstaged: 3, untracked: 1 });
    git.setAllChanges([
      createMockChange({ path: 'src/main.ts', status: 'M' }),
      createMockChange({ path: 'src/utils.ts', status: 'A' }),
    ]);
    generateProseFn.mockResolvedValue(success('# Session Briefing\nAll clear.'));
  });

  it('returns prose text on happy path', async () => {
    const handler = createSessionBriefingHandler(git, logger, generateProseFn);
    const result = await handler(createMockContext(), {} as any);

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value).toBe('# Session Briefing\nAll clear.');
    }
  });

  it('propagates error when gitProvider.status() fails', async () => {
    vi.spyOn(git, 'status').mockResolvedValue(
      failure({ code: 'GIT_STATUS_ERROR', message: 'git not found' })
    );

    const handler = createSessionBriefingHandler(git, logger, generateProseFn);
    const result = await handler(createMockContext(), {} as any);

    expect(result.kind).toBe('err');
    if (result.kind === 'err') {
      expect(result.error.code).toBe('GIT_STATUS_ERROR');
    }
    expect(generateProseFn).not.toHaveBeenCalled();
  });

  it('propagates error when gitProvider.getRecentCommits() fails', async () => {
    vi.spyOn(git, 'getRecentCommits').mockResolvedValue(
      failure({ code: 'GIT_STATUS_ERROR', message: 'log failed' })
    );

    const handler = createSessionBriefingHandler(git, logger, generateProseFn);
    const result = await handler(createMockContext(), {} as any);

    expect(result.kind).toBe('err');
    if (result.kind === 'err') {
      expect(result.error.message).toBe('log failed');
    }
    expect(generateProseFn).not.toHaveBeenCalled();
  });

  it('propagates error when gitProvider.getAllChanges() fails', async () => {
    vi.spyOn(git, 'getAllChanges').mockResolvedValue(
      failure({ code: 'GET_CHANGES_FAILED', message: 'diff error' })
    );

    const handler = createSessionBriefingHandler(git, logger, generateProseFn);
    const result = await handler(createMockContext(), {} as any);

    expect(result.kind).toBe('err');
    if (result.kind === 'err') {
      expect(result.error.code).toBe('GET_CHANGES_FAILED');
    }
    expect(generateProseFn).not.toHaveBeenCalled();
  });

  it('flags large number of uncommitted files when >10', async () => {
    const manyChanges = Array.from({ length: 12 }, (_, i) =>
      createMockChange({ path: `src/file${i}.ts`, status: 'M' })
    );
    git.setAllChanges(manyChanges);

    const handler = createSessionBriefingHandler(git, logger, generateProseFn);
    await handler(createMockContext(), {} as any);

    expect(generateProseFn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          flags: expect.arrayContaining(['Large number of uncommitted files (12)']),
        }),
      })
    );
  });

  it('flags detached HEAD when branch is "HEAD"', async () => {
    git.setStatus({ branch: 'HEAD', isDirty: false, staged: 0, unstaged: 0, untracked: 0 });

    const handler = createSessionBriefingHandler(git, logger, generateProseFn);
    await handler(createMockContext(), {} as any);

    expect(generateProseFn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          flags: expect.arrayContaining(['Detached HEAD — not on a named branch']),
        }),
      })
    );
  });

  it('propagates error when generateProseFn fails', async () => {
    generateProseFn.mockResolvedValue(
      failure({ code: 'MODEL_UNAVAILABLE', message: 'no language model' })
    );

    const handler = createSessionBriefingHandler(git, logger, generateProseFn);
    const result = await handler(createMockContext(), {} as any);

    expect(result.kind).toBe('err');
    if (result.kind === 'err') {
      expect(result.error.code).toBe('MODEL_UNAVAILABLE');
    }
  });
});
