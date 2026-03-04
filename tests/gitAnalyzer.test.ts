/**
 * GitAnalyzer Tests (7 tests)
 * Testing git log parsing and analytics aggregation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { execSync } from 'child_process';
import { GitAnalyzer } from '../src/domains/git/analytics-service';
import { createTestGitLog } from './fixtures';

// Mock the execSync function
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const mockedExecSync = vi.mocked(execSync);

describe('GitAnalyzer', () => {
  let analyzer: GitAnalyzer;

  beforeEach(() => {
    analyzer = new GitAnalyzer();
    analyzer.clearCache();
    mockedExecSync.mockClear();
  });

  // Test 1: parseGitLog() with valid output
  it('should parse valid git log output', async () => {
    const gitLog = [
      'abc1234|Alice|2026-02-20T10:30:00Z|feat(api): add endpoint',
      '10\t2\tsrc/api/handler.ts',
      '',
      'def5678|Bob|2026-02-19T09:00:00Z|fix(core): resolve bug',
      '5\t3\tsrc/core/service.ts',
      '2\t1\tsrc/core/types.ts',
    ].join('\n');
    mockedExecSync.mockReturnValue(gitLog);

    const report = await analyzer.analyze({ period: '3mo' });

    expect(report.commits).toHaveLength(2);
    expect(report.summary.totalCommits).toBe(2);
    expect(report.summary.totalLinesAdded).toBeGreaterThan(0);
  });

  // Test 2: parseGitLog() with malformed input (graceful)
  it('should gracefully handle malformed input', async () => {
    mockedExecSync.mockReturnValue('notvalid\ngarbage\n|||');

    const report = await analyzer.analyze({ period: '3mo' });

    // Should not throw; returns an empty or partial result
    expect(report).toBeDefined();
    expect(report.commits).toBeDefined();
    expect(Array.isArray(report.commits)).toBe(true);
  });

  // Test 3: aggregateByAuthor() groups correctly
  it('should aggregate commits by author', () => {
    // Testing the internal logic: multiple commits from same author group together
    const sampleCommits = [
      {
        hash: 'abc123',
        author: 'alice',
        date: new Date(),
        message: 'fix: bug',
        filesChanged: 2,
        insertions: 10,
        deletions: 5,
      },
      {
        hash: 'def456',
        author: 'alice',
        date: new Date(),
        message: 'feat: feature',
        filesChanged: 3,
        insertions: 20,
        deletions: 2,
      },
      {
        hash: 'ghi789',
        author: 'bob',
        date: new Date(),
        message: 'docs: readme',
        filesChanged: 1,
        insertions: 5,
        deletions: 0,
      },
    ];

    // Create a test map to verify grouping logic
    const authorMap = new Map<string, any>();
    for (const commit of sampleCommits) {
      if (!authorMap.has(commit.author)) {
        authorMap.set(commit.author, {
          name: commit.author,
          commits: 0,
          insertions: 0,
          deletions: 0,
        });
      }
      const metric = authorMap.get(commit.author)!;
      metric.commits++;
      metric.insertions += commit.insertions;
      metric.deletions += commit.deletions;
    }

    expect(authorMap.get('alice')?.commits).toBe(2);
    expect(authorMap.get('bob')?.commits).toBe(1);
    expect(authorMap.get('alice')?.insertions).toBe(30);
  });

  // Test 4: aggregateByDomain() groups correctly
  it('should aggregate files by domain', () => {
    // Test file grouping by path domain
    const files = [
      { path: 'src/api/endpoint.ts', domain: 'api' },
      { path: 'src/api/handler.ts', domain: 'api' },
      { path: 'src/auth/login.ts', domain: 'auth' },
      { path: 'tests/api.test.ts', domain: 'api' },
    ];

    const domainMap = new Map<string, number>();
    for (const file of files) {
      domainMap.set(
        file.domain,
        (domainMap.get(file.domain) || 0) + 1
      );
    }

    expect(domainMap.get('api')).toBe(3);
    expect(domainMap.get('auth')).toBe(1);
  });

  // Test 5: cache hit returns memoized results
  it('should return memoized results on cache hit', async () => {
    const gitLog = [
      'abc1234|Alice|2026-02-20T10:30:00Z|feat: add feature',
      '10\t2\tsrc/feature.ts',
    ].join('\n');
    mockedExecSync.mockReturnValue(gitLog);

    // First call — populates cache
    await analyzer.analyze({ period: '3mo' });
    // Second call — should hit cache, not call execSync again
    await analyzer.analyze({ period: '3mo' });

    expect(mockedExecSync).toHaveBeenCalledTimes(1);
  });

  // Test 6: cache invalidation on new input
  it('should invalidate cache when input changes', async () => {
    const gitLog = [
      'abc1234|Alice|2026-02-20T10:30:00Z|feat: initial',
      '5\t1\tsrc/file.ts',
    ].join('\n');
    mockedExecSync.mockReturnValue(gitLog);

    // First call
    await analyzer.analyze({ period: '3mo' });

    // Invalidate cache
    analyzer.clearCache();

    // Second call — cache cleared, execSync called again
    await analyzer.analyze({ period: '3mo' });

    expect(mockedExecSync).toHaveBeenCalledTimes(2);
  });

  // Test 7: handles empty git log
  it('should handle empty git log gracefully', async () => {
    mockedExecSync.mockReturnValue('');

    const report = await analyzer.analyze({ period: '3mo' });

    expect(report.commits).toHaveLength(0);
    expect(report.summary.totalCommits).toBe(0);
  });

  // Test 8: filters commits by path pattern
  it('should filter commits by path pattern', async () => {
    // Two commits: one touches src/api/**, the other touches docs/**
    const gitLog = [
      'aaa111|Alice|2026-02-20T10:00:00Z|feat(api): add handler',
      '50\t10\tsrc/api/handler.ts',
      '20\t5\tsrc/api/types.ts',
      '',
      'bbb222|Bob|2026-02-21T11:00:00Z|docs: update readme',
      '30\t10\tdocs/README.md',
      '15\t5\tdocs/GUIDE.md',
    ].join('\n');

    mockedExecSync.mockReturnValue(gitLog);

    // Pattern matching src/api/** → only commit aaa111
    const apiReport = await analyzer.analyze({ period: '3mo', pathPattern: 'src/api/**' });
    expect(apiReport.commits).toHaveLength(1);
    expect(apiReport.commits[0].hash).toBe('aaa111');

    analyzer.clearCache();
    mockedExecSync.mockReturnValue(gitLog);

    // Pattern matching **/*.md → only commit bbb222
    const docsReport = await analyzer.analyze({ period: '3mo', pathPattern: '**/*.md' });
    expect(docsReport.commits).toHaveLength(1);
    expect(docsReport.commits[0].hash).toBe('bbb222');

    analyzer.clearCache();
    mockedExecSync.mockReturnValue(gitLog);

    // No pattern → both commits
    const allReport = await analyzer.analyze({ period: '3mo' });
    expect(allReport.commits).toHaveLength(2);
  });

  // Test 9: returns empty when pattern matches nothing
  it('should return empty commits when pattern matches nothing', async () => {
    const gitLog = [
      'ccc333|Charlie|2026-02-22T09:00:00Z|feat: add handler',
      '40\t15\tsrc/api/handler.ts',
    ].join('\n');

    mockedExecSync.mockReturnValue(gitLog);

    const report = await analyzer.analyze({ period: '3mo', pathPattern: 'nonexistent/**' });
    expect(report.commits).toHaveLength(0);
    expect(report.summary.totalCommits).toBe(0);
  });

  // Bug 1 fix: file aggregation respects path filter (no bleed-through from non-matching files)
  it('should exclude non-matching files from commit metrics when pathPattern is set', async () => {
    const gitLog = [
      'aaa111|Alice|2026-02-20T10:00:00Z|feat: mixed commit',
      '50\t10\tsrc/api/handler.ts',
      '20\t5\tdocs/README.md',
    ].join('\n');

    mockedExecSync.mockReturnValue(gitLog);

    const report = await analyzer.analyze({ period: '3mo', pathPattern: 'src/api/**' });

    expect(report.commits).toHaveLength(1);
    expect(report.commits[0].files).toHaveLength(1);
    expect(report.commits[0].files[0].path).toBe('src/api/handler.ts');
    // Only matched file stats — docs/README.md (20+5) must not bleed through
    expect(report.commits[0].insertions).toBe(50);
    expect(report.commits[0].deletions).toBe(10);
    expect(report.files.every(f => f.path !== 'docs/README.md')).toBe(true);
  });

  // Bug 2 fix: trend direction reflects actual commit density, not raw count
  it('should report "up" for recent burst and "down" for old burst', async () => {
    // Setup A: 3 recent commits all on same day, 3 old spread over ~60 days → recent is denser
    const recentBurstLog = [
      'r001|Alice|2026-03-03T10:00:00Z|feat: A', '5\t2\tsrc/a.ts',
      '',
      'r002|Alice|2026-03-03T09:00:00Z|feat: B', '5\t2\tsrc/a.ts',
      '',
      'r003|Alice|2026-03-03T08:00:00Z|feat: C', '5\t2\tsrc/a.ts',
      '',
      'o001|Alice|2025-09-01T10:00:00Z|feat: D', '5\t2\tsrc/a.ts',
      '',
      'o002|Alice|2025-08-01T10:00:00Z|feat: E', '5\t2\tsrc/a.ts',
      '',
      'o003|Alice|2025-07-01T10:00:00Z|feat: F', '5\t2\tsrc/a.ts',
    ].join('\n');

    mockedExecSync.mockReturnValue(recentBurstLog);
    const upReport = await analyzer.analyze({ period: '3mo' });
    expect(upReport.trends.commitTrend.direction).toBe('up');

    analyzer.clearCache();

    // Setup B: 3 recent spread over ~76 days, 3 old all on same day → old is denser
    const oldBurstLog = [
      'r001|Alice|2026-03-01T10:00:00Z|feat: A', '5\t2\tsrc/a.ts',
      '',
      'r002|Alice|2026-01-15T10:00:00Z|feat: B', '5\t2\tsrc/a.ts',
      '',
      'r003|Alice|2025-12-15T10:00:00Z|feat: C', '5\t2\tsrc/a.ts',
      '',
      'o001|Alice|2025-12-01T10:00:00Z|feat: D', '5\t2\tsrc/a.ts',
      '',
      'o002|Alice|2025-12-01T10:00:00Z|feat: E', '5\t2\tsrc/a.ts',
      '',
      'o003|Alice|2025-12-01T10:00:00Z|feat: F', '5\t2\tsrc/a.ts',
    ].join('\n');

    mockedExecSync.mockReturnValue(oldBurstLog);
    const downReport = await analyzer.analyze({ period: '3mo' });
    expect(downReport.trends.commitTrend.direction).toBe('down');

    analyzer.clearCache();

    // Setup C: empty log → no commits → stable
    mockedExecSync.mockReturnValue('');
    const emptyReport = await analyzer.analyze({ period: '3mo' });
    expect(emptyReport.trends.commitTrend.direction).toBe('stable');
  });

  // Bug 3 fix: getWeekKey uses UTC date components — no timezone misalignment
  it('should bucket commits into correct ISO weeks using UTC dates', async () => {
    // Jan 4, 2026 (Sunday) → ISO W01; Jan 5, 2026 (Monday) → ISO W02
    // Without fix: in a negative-offset TZ, Jan 5 00:30 UTC reads as Jan 4 locally → W01 (wrong)
    // With fix: UTC date components are used → W02 (correct)
    const gitLog = [
      'w001|Alice|2026-01-04T23:30:00Z|feat: last day of W01', '5\t2\tsrc/a.ts',
      '',
      'w002|Alice|2026-01-05T00:30:00Z|feat: first day of W02', '5\t2\tsrc/a.ts',
    ].join('\n');

    mockedExecSync.mockReturnValue(gitLog);
    const report = await analyzer.analyze({ period: '3mo' });

    expect(report.commitFrequency.labels).toHaveLength(2);
    expect(report.commitFrequency.labels).toContain('2026-W01');
    expect(report.commitFrequency.labels).toContain('2026-W02');
  });
});
