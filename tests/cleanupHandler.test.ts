/**
 * Cleanup Handler Tests — hygiene.cleanup
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockWorkspaceProvider, MockLogger, createMockContext } from './fixtures';
import { createCleanupHandler } from '../src/domains/hygiene/cleanup-handler';
import { success, failure } from '../src/types';

describe('hygiene.cleanup', () => {
  let wp: MockWorkspaceProvider;
  let logger: MockLogger;

  beforeEach(() => {
    wp = new MockWorkspaceProvider();
    logger = new MockLogger();
  });

  it('returns HYGIENE_CLEANUP_NO_FILES when files param is undefined', async () => {
    const handler = createCleanupHandler(wp, logger);
    const result = await handler(createMockContext(), {} as any);

    expect(result.kind).toBe('err');
    if (result.kind === 'err') {
      expect(result.error.code).toBe('HYGIENE_CLEANUP_NO_FILES');
    }
  });

  it('returns HYGIENE_CLEANUP_NO_FILES when files array is empty', async () => {
    const handler = createCleanupHandler(wp, logger);
    const result = await handler(createMockContext(), { files: [] } as any);

    expect(result.kind).toBe('err');
    if (result.kind === 'err') {
      expect(result.error.code).toBe('HYGIENE_CLEANUP_NO_FILES');
    }
  });

  it('dry run returns file list without deleting anything', async () => {
    const files = ['src/old.ts', 'src/legacy.ts', 'tmp/cache.json'];

    const handler = createCleanupHandler(wp, logger);
    const result = await handler(createMockContext(), { dryRun: true, files } as any);

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.dryRun).toBe(true);
      expect(result.value.files).toEqual(files);
      expect(result.value.deleted).toEqual([]);
      expect(result.value.failed).toEqual([]);
    }
  });

  it('deletes all files successfully on execute', async () => {
    const files = ['src/old.ts', 'src/legacy.ts'];
    vi.spyOn(wp, 'deleteFile').mockResolvedValue(success(void 0));

    const handler = createCleanupHandler(wp, logger);
    const result = await handler(createMockContext(), { files } as any);

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.dryRun).toBe(false);
      expect(result.value.deleted).toEqual(['src/old.ts', 'src/legacy.ts']);
      expect(result.value.failed).toEqual([]);
    }
  });

  it('tracks partial failures with reasons', async () => {
    const files = ['good.ts', 'bad.txt', 'also-good.ts'];
    vi.spyOn(wp, 'deleteFile').mockImplementation(async (path: string) => {
      if (path === 'bad.txt') {
        return failure({ code: 'FILE_DELETE_ERROR', message: 'Permission denied' });
      }
      return success(void 0);
    });

    const handler = createCleanupHandler(wp, logger);
    const result = await handler(createMockContext(), { files } as any);

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.deleted).toEqual(['good.ts', 'also-good.ts']);
      expect(result.value.failed).toEqual([
        { path: 'bad.txt', reason: 'Permission denied' },
      ]);
    }
  });

  it('returns HYGIENE_CLEANUP_ERROR when an unexpected error is thrown', async () => {
    vi.spyOn(wp, 'deleteFile').mockImplementation(async () => {
      throw new Error('disk I/O failure');
    });

    const handler = createCleanupHandler(wp, logger);
    const result = await handler(createMockContext(), { files: ['crash.ts'] } as any);

    expect(result.kind).toBe('err');
    if (result.kind === 'err') {
      expect(result.error.code).toBe('HYGIENE_CLEANUP_ERROR');
    }
  });
});
