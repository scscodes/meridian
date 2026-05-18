/**
 * Session Briefing Handler Tests — git.sessionBriefing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockGitProvider, MockLogger, MockRunLog, createMockContext, createMockChange } from './fixtures';
import { createSessionBriefingHandler } from '../src/domains/git/session-handler';
import { SessionBriefingSources } from '../src/domains/git/session-aggregator';
import { success, failure } from '../src/types';
import { GitAnalyzer } from '../src/domains/git/analytics-service';

function makeSources(
  git: MockGitProvider,
  logger: MockLogger,
  runLog: MockRunLog,
  overrides: Partial<SessionBriefingSources> = {}
): SessionBriefingSources {
  return {
    gitProvider: git as any,
    runLog,
    gitAnalyzer: { analyze: vi.fn().mockRejectedValue(new Error('no git')) } as unknown as GitAnalyzer,
    getHygieneScan: () => undefined,
    logger,
    ...overrides,
  };
}

describe('git.sessionBriefing', () => {
  let git: MockGitProvider;
  let logger: MockLogger;
  let runLog: MockRunLog;
  let generateProseFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    git = new MockGitProvider();
    logger = new MockLogger();
    runLog = new MockRunLog();
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
    const handler = createSessionBriefingHandler(makeSources(git, logger, runLog), generateProseFn);
    const result = await handler(createMockContext(), {} as any);

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.summary).toBe('# Session Briefing\nAll clear.');
      expect(result.value.branch).toBe('develop');
      expect(result.value.isDirty).toBe(true);
      expect(result.value.staged).toBe(2);
      expect(result.value.uncommittedFiles).toHaveLength(2);
      expect(result.value.generatedAt).toBeTruthy();
    }
  });

  it('propagates error when gitProvider.status() fails', async () => {
    vi.spyOn(git, 'status').mockResolvedValue(
      failure({ code: 'GIT_STATUS_ERROR', message: 'git not found' })
    );

    const handler = createSessionBriefingHandler(makeSources(git, logger, runLog), generateProseFn);
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

    const handler = createSessionBriefingHandler(makeSources(git, logger, runLog), generateProseFn);
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

    const handler = createSessionBriefingHandler(makeSources(git, logger, runLog), generateProseFn);
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

    const handler = createSessionBriefingHandler(makeSources(git, logger, runLog), generateProseFn);
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

    const handler = createSessionBriefingHandler(makeSources(git, logger, runLog), generateProseFn);
    await handler(createMockContext(), {} as any);

    expect(generateProseFn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          flags: expect.arrayContaining(['Detached HEAD — not on a named branch']),
        }),
      })
    );
  });

  it('degrades to deterministic summary when generateProseFn fails', async () => {
    generateProseFn.mockResolvedValue(
      failure({ code: 'MODEL_UNAVAILABLE', message: 'no language model' })
    );

    const handler = createSessionBriefingHandler(makeSources(git, logger, runLog), generateProseFn);
    const result = await handler(createMockContext(), {} as any);

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.summary).toContain("Branch 'develop'");
      expect(result.value.summary).toContain('dirty');
      expect(result.value.summary).toContain('staged: 2');
      expect(result.value.branch).toBe('develop');
      expect(result.value.isDirty).toBe(true);
    }
  });

  it('degrades to deterministic summary when no generateProseFn is injected', async () => {
    const handler = createSessionBriefingHandler(makeSources(git, logger, runLog));
    const result = await handler(createMockContext(), {} as any);

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.summary).toContain("Branch 'develop'");
      expect(result.value.summary).toContain('uncommitted file');
      expect(result.value.uncommittedFiles).toHaveLength(2);
    }
  });

  it('surfaces optional aggregate fields in the returned report', async () => {
    const mockScan = {
      scan: {
        deadFiles: ['tmp/foo.tmp'],
        largeFiles: [],
        logFiles: [],
        markdownFiles: [],
        deadCode: { items: [], tsconfigPath: null, durationMs: 0, fileCount: 0 },
      },
      scannedAt: '2026-04-20T00:00:00.000Z',
    };
    const sources = makeSources(git, logger, runLog, {
      getHygieneScan: () => mockScan,
    });

    const handler = createSessionBriefingHandler(sources, generateProseFn);
    const result = await handler(createMockContext(), {} as any);

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.hygieneSnapshot).toBeDefined();
      expect(result.value.hygieneSnapshot?.deadFileCount).toBe(1);
      expect(result.value.summary).toBeTruthy();
    }
  });
});
