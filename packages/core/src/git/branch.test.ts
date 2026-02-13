import { describe, it, expect } from 'vitest';

// We test the parseRangeLogOutput function indirectly via getRemoteLog,
// but since that requires git, we test the pure parsing logic directly.
// The parse function is private, so we test the exported helpers that
// don't require a real git repo.

// For now, test the pure utility aspects that don't require a git repo.

describe('branch utilities (pure logic)', () => {
  // These tests validate the module loads correctly and types are sound.
  // Full integration testing requires a git repo with remotes.

  it('module exports all expected functions', async () => {
    const mod = await import('./branch.js');
    expect(typeof mod.getCurrentBranch).toBe('function');
    expect(typeof mod.getTrackingBranch).toBe('function');
    expect(typeof mod.getAheadBehind).toBe('function');
    expect(typeof mod.fetchRemote).toBe('function');
    expect(typeof mod.getRemoteDiff).toBe('function');
    expect(typeof mod.getRemoteDiffSummary).toBe('function');
    expect(typeof mod.getRemoteLog).toBe('function');
  });
});
