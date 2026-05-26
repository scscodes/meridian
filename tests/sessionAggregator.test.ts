/**
 * Session Briefing Aggregator Tests — aggregateSessionBriefing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockGitProvider, MockLogger, MockRunLog, createMockChange } from './fixtures';
import { aggregateSessionBriefing, SessionBriefingSources } from '../src/domains/git/session-aggregator';
import { success, failure, RunEventV1, RUN_EVENT_SCHEMA_VERSION } from '../src/types';
import { GitAnalyzer } from '../src/domains/git/analytics-service';
import type { GitAnalyticsReport } from '../src/domains/git/analytics-types';
import { SESSION_BRIEFING, PENDING_RISK } from '../src/constants';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAnalyzer(overrides?: Partial<GitAnalyticsReport>): GitAnalyzer {
  const report: GitAnalyticsReport = {
    period: "3mo",
    generatedAt: new Date(),
    summary: {
      totalCommits: 42,
      totalAuthors: 3,
      totalFilesModified: 18,
      totalLinesAdded: 500,
      totalLinesDeleted: 200,
      commitFrequency: 3.5,
      averageCommitSize: 16,
      churnRate: 0.4,
    },
    commits: [],
    files: [],
    authors: [],
    trends: {
      commitTrend: { slope: 0.1, direction: "up", confidence: 0.75 },
      volatilityTrend: { slope: -0.05, direction: "stable" },
    },
    commitFrequency: { labels: [], data: [] },
    churnFiles: [],
    topAuthors: [
      { name: "Alice", commits: 20, insertions: 300, deletions: 100, filesChanged: 12, lastActive: new Date() },
      { name: "Bob", commits: 15, insertions: 150, deletions: 80, filesChanged: 8, lastActive: new Date() },
    ],
    ...overrides,
  };
  return { analyze: vi.fn().mockResolvedValue(report) } as unknown as GitAnalyzer;
}

function makeCompleteEvent(runId: string, durationMs = 100): RunEventV1 {
  return {
    schemaVersion: RUN_EVENT_SCHEMA_VERSION,
    eventId: `evt-${runId}`,
    runId,
    timestampMs: Date.now(),
    source: "router",
    phase: "complete",
    resultKind: "ok",
    commandName: "git.status",
    durationMs,
  };
}

function makeFailEvent(runId: string, errorCode = "SOME_ERROR"): RunEventV1 {
  return {
    schemaVersion: RUN_EVENT_SCHEMA_VERSION,
    eventId: `evt-fail-${runId}`,
    runId,
    timestampMs: Date.now(),
    source: "router",
    phase: "fail",
    resultKind: "err",
    commandName: "git.pull",
    errorCode,
    errorMessage: "something broke",
    durationMs: 50,
  };
}

function makeStartEvent(runId: string): RunEventV1 {
  return {
    schemaVersion: RUN_EVENT_SCHEMA_VERSION,
    eventId: `evt-start-${runId}`,
    runId,
    timestampMs: Date.now(),
    source: "router",
    phase: "start",
  };
}

function makeSources(
  git: MockGitProvider,
  logger: MockLogger,
  runLog: MockRunLog,
  overrides: Partial<SessionBriefingSources> = {}
): SessionBriefingSources {
  return {
    gitProvider: git as any,
    runLog,
    gitAnalyzer: makeAnalyzer(),
    getHygieneScan: () => undefined,
    logger,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('aggregateSessionBriefing', () => {
  let git: MockGitProvider;
  let logger: MockLogger;
  let runLog: MockRunLog;

  beforeEach(() => {
    git = new MockGitProvider();
    logger = new MockLogger();
    runLog = new MockRunLog();

    git.setStatus({ branch: 'main', isDirty: false, staged: 0, unstaged: 0, untracked: 0 });
    git.setAllChanges([]);
  });

  // ── 1. Happy path ──────────────────────────────────────────────────────────
  it('returns full SessionBriefing with all optional slices when all sources available', async () => {
    runLog.setEvents([makeCompleteEvent('run-1')]);
    const scan = {
      scan: {
        deadFiles: [],
        largeFiles: [],
        logFiles: [],
        markdownFiles: [],
        deadCode: { items: [], tsconfigPath: null, durationMs: 0, fileCount: 0 },
      },
      scannedAt: '2026-04-20T00:00:00.000Z',
    };
    const sources = makeSources(git, logger, runLog, {
      gitAnalyzer: makeAnalyzer(),
      getHygieneScan: () => scan,
    });

    const result = await aggregateSessionBriefing(sources);

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.branch).toBe('main');
      expect(result.value.recentRuns).toBeDefined();
      expect(result.value.activityWindow).toBeDefined();
      expect(result.value.hygieneSnapshot).toBeDefined();
    }
  });

  // ── 2. Empty run log → recentRuns present but empty ───────────────────────
  it('returns recentRuns as empty array when run log has no events', async () => {
    runLog.setEvents([]);
    const result = await aggregateSessionBriefing(makeSources(git, logger, runLog));

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.recentRuns).toBeDefined();
      expect(result.value.recentRuns).toHaveLength(0);
    }
  });

  // ── 3. Run log error → recentRuns omitted, flag added ─────────────────────
  it('omits recentRuns and adds flag when run log read fails', async () => {
    runLog.forceReadError({ code: 'RUN_LOG_READ_ERROR', message: 'disk error' });
    const result = await aggregateSessionBriefing(makeSources(git, logger, runLog));

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.recentRuns).toBeUndefined();
      expect(result.value.flags).toContain('Run log read failed');
    }
    expect(logger.getByLevel('warn').some((l) => l.message.includes('run log read failed'))).toBe(true);
  });

  // ── 4. Analyzer throws → activityWindow omitted, flag added ───────────────
  it('omits activityWindow and adds flag when analyzer throws', async () => {
    const brokenAnalyzer = { analyze: vi.fn().mockRejectedValue(new Error('no git repo')) } as unknown as GitAnalyzer;
    const result = await aggregateSessionBriefing(makeSources(git, logger, runLog, { gitAnalyzer: brokenAnalyzer }));

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.activityWindow).toBeUndefined();
      expect(result.value.flags).toContain('Analytics unavailable');
    }
  });

  // ── 5. No hygiene scan → hygieneSnapshot omitted, flag added ──────────────
  it('omits hygieneSnapshot and adds flag when no scan cached', async () => {
    const result = await aggregateSessionBriefing(
      makeSources(git, logger, runLog, { getHygieneScan: () => undefined })
    );

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.hygieneSnapshot).toBeUndefined();
      expect(result.value.flags).toContain('No hygiene scan yet');
    }
  });

  // ── 6. Run log projection: filters non-terminal phases ────────────────────
  it('filters start/step events, keeps complete and fail, carries all fields', async () => {
    runLog.setEvents([
      makeStartEvent('r1'),
      makeCompleteEvent('r1', 200),
      makeFailEvent('r2', 'TIMEOUT'),
    ]);
    const result = await aggregateSessionBriefing(makeSources(git, logger, runLog));

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      const runs = result.value.recentRuns!;
      expect(runs).toHaveLength(2);
      const complete = runs.find((r) => r.phase === 'complete')!;
      expect(complete.commandName).toBe('git.status');
      expect(complete.durationMs).toBe(200);
      const fail = runs.find((r) => r.phase === 'fail')!;
      expect(fail.errorCode).toBe('TIMEOUT');
      expect(fail.commandName).toBe('git.pull');
    }
  });

  // ── 7. Flag: run failures above threshold ─────────────────────────────────
  it('adds failure-count flag when at least one run failed', async () => {
    runLog.setEvents([makeFailEvent('r1'), makeFailEvent('r2')]);
    const result = await aggregateSessionBriefing(makeSources(git, logger, runLog));

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.flags.some((f) => f.startsWith('Recent run failures:'))).toBe(true);
    }
  });

  // ── 8. Hygiene flags: dead files and large files above thresholds ──────────
  it('adds hygiene flags when scan counts exceed thresholds', async () => {
    const deadFiles = Array.from({ length: 5 }, (_, i) => `tmp/file${i}.tmp`);
    const largeFiles = Array.from({ length: 3 }, (_, i) => ({ path: `data/big${i}.bin`, sizeBytes: 1e7 }));
    const scan = {
      scan: {
        deadFiles,
        largeFiles,
        logFiles: [],
        markdownFiles: [],
        deadCode: { items: [], tsconfigPath: null, durationMs: 0, fileCount: 0 },
      },
      scannedAt: '2026-04-20T00:00:00.000Z',
    };
    const result = await aggregateSessionBriefing(
      makeSources(git, logger, runLog, { getHygieneScan: () => scan })
    );

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.flags.some((f) => f.includes('dead files'))).toBe(true);
      expect(result.value.flags.some((f) => f.includes('large files'))).toBe(true);
    }
  });

  // ── 9. Git-core failure → aggregate fails fast ────────────────────────────
  it('fails immediately when gitProvider.status() fails', async () => {
    vi.spyOn(git, 'status').mockResolvedValue(
      failure({ code: 'GIT_STATUS_ERROR', message: 'git not found' })
    );

    const result = await aggregateSessionBriefing(makeSources(git, logger, runLog));
    expect(result.kind).toBe('err');
    if (result.kind === 'err') {
      expect(result.error.code).toBe('GIT_STATUS_ERROR');
    }
  });

  // ── 10. Uncommitted files flag preserved ──────────────────────────────────
  it('raises uncommitted-files flag when count exceeds threshold', async () => {
    const manyChanges = Array.from({ length: 11 }, (_, i) =>
      createMockChange({ path: `src/file${i}.ts`, status: 'M' })
    );
    git.setAllChanges(manyChanges);

    const result = await aggregateSessionBriefing(makeSources(git, logger, runLog));

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.flags.some((f) => f.startsWith('Large number of uncommitted files'))).toBe(true);
    }
  });

  // ── 11. runLog undefined → Run log unavailable flag ───────────────────────
  it('adds "Run log unavailable" flag when runLog is not provided', async () => {
    const result = await aggregateSessionBriefing(
      makeSources(git, logger, runLog, { runLog: undefined })
    );

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.recentRuns).toBeUndefined();
      expect(result.value.flags).toContain('Run log unavailable');
    }
  });

  // ── 12. T1 — recentCommitLimit constant + option override ─────────────────
  it('fetches RECENT_COMMIT_LIMIT commits by default and honors the option override', async () => {
    const spy = vi.spyOn(git, 'getRecentCommits');

    await aggregateSessionBriefing(makeSources(git, logger, runLog));
    expect(spy).toHaveBeenLastCalledWith(SESSION_BRIEFING.RECENT_COMMIT_LIMIT);

    await aggregateSessionBriefing(
      makeSources(git, logger, runLog, { options: { recentCommitLimit: 3 } })
    );
    expect(spy).toHaveBeenLastCalledWith(3);
  });

  // ── 13. T1 — topContributors capped at TOP_CONTRIBUTORS_LIMIT ─────────────
  it('caps topContributors at SESSION_BRIEFING.TOP_CONTRIBUTORS_LIMIT', async () => {
    const manyAuthors = Array.from({ length: 6 }, (_, i) => ({
      name: `A${i}`, commits: 10 - i, insertions: 0, deletions: 0, filesChanged: 0, lastActive: new Date(),
    }));
    const result = await aggregateSessionBriefing(
      makeSources(git, logger, runLog, { gitAnalyzer: makeAnalyzer({ topAuthors: manyAuthors }) })
    );
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.activityWindow?.topContributors).toHaveLength(
        SESSION_BRIEFING.TOP_CONTRIBUTORS_LIMIT
      );
    }
  });

  // ── 14. T3 — trends + capped churn sample retained from analytics ─────────
  it('retains trends and a capped churn sample in the activity window', async () => {
    const churn = Array.from({ length: 8 }, (_, i) => ({
      path: `src/f${i}.ts`, commitCount: 9 - i, insertions: 0, deletions: 0,
      volatility: 9 - i, authors: [], lastModified: new Date(), risk: 'high' as const,
    }));
    const result = await aggregateSessionBriefing(
      makeSources(git, logger, runLog, { gitAnalyzer: makeAnalyzer({ churnFiles: churn }) })
    );
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      const w = result.value.activityWindow;
      expect(w?.trends).toEqual({
        commitDirection: 'up',
        commitConfidence: 0.75,
        volatilityDirection: 'stable',
      });
      expect(w?.topChurnFiles).toHaveLength(SESSION_BRIEFING.CHURN_SAMPLE_LIMIT);
      expect(w?.topChurnFiles?.[0]).toEqual({ path: 'src/f0.ts', volatility: 9, risk: 'high' });
    }
  });

  // ── 15. T3 — dead-code sample retained, omitted when empty ────────────────
  it('retains a capped dead-code sample, omitting it when there are none', async () => {
    const withItems = {
      scan: {
        deadFiles: [], largeFiles: [], logFiles: [], markdownFiles: [],
        deadCode: {
          items: Array.from({ length: 7 }, (_, i) => ({
            filePath: `/abs/f${i}.ts`, line: i + 1, character: 1,
            message: `unused ${i}`, code: 6133, category: 'unusedLocal' as const,
          })),
          tsconfigPath: null, durationMs: 0, fileCount: 7,
        },
      },
      scannedAt: '2026-05-19T00:00:00.000Z',
    };
    const r1 = await aggregateSessionBriefing(
      makeSources(git, logger, runLog, { getHygieneScan: () => withItems })
    );
    expect(r1.kind).toBe('ok');
    if (r1.kind === 'ok') {
      const s = r1.value.hygieneSnapshot;
      expect(s?.deadCodeSample).toHaveLength(SESSION_BRIEFING.DEAD_CODE_SAMPLE_LIMIT);
      expect(s?.deadCodeSample?.[0]).toEqual({ filePath: '/abs/f0.ts', line: 1, message: 'unused 0' });
    }

    const empty = {
      scan: {
        deadFiles: [], largeFiles: [], logFiles: [], markdownFiles: [],
        deadCode: { items: [], tsconfigPath: null, durationMs: 0, fileCount: 0 },
      },
      scannedAt: '2026-05-19T00:00:00.000Z',
    };
    const r2 = await aggregateSessionBriefing(
      makeSources(git, logger, runLog, { getHygieneScan: () => empty })
    );
    expect(r2.kind).toBe('ok');
    if (r2.kind === 'ok') {
      expect(r2.value.hygieneSnapshot?.deadCodeSample).toBeUndefined();
    }
  });

  // ── 16. T2 — hoisted analytics does not break git-core fail-fast ──────────
  it('still returns the git-core error when commits fail, with analytics hoisted', async () => {
    const analyzer = makeAnalyzer();
    vi.spyOn(git, 'getRecentCommits').mockResolvedValue(
      failure({ code: 'GIT_LOG_ERROR', message: 'log failed' })
    );
    const result = await aggregateSessionBriefing(
      makeSources(git, logger, runLog, { gitAnalyzer: analyzer })
    );
    expect(result.kind).toBe('err');
    if (result.kind === 'err') {
      expect(result.error.code).toBe('GIT_LOG_ERROR');
    }
    // analytics was started (hoisted) but did not affect the failed result
    expect(analyzer.analyze as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalled();
  });

  // ── 17. Pending-change risk — dirty-set × analytics risk join ────────────
  const fm = (
    path: string,
    risk: 'high' | 'medium' | 'low',
    volatility: number,
    commitCount = 5
  ) => ({
    path, commitCount, insertions: 0, deletions: 0, volatility,
    authors: [] as string[], lastModified: new Date(), risk,
  });

  it('joins dirty files to analytics risk; annotates new (A) vs cold (M/D) when absent', async () => {
    git.setAllChanges([
      createMockChange({ path: 'src/hot.ts', status: 'M' }),
      createMockChange({ path: 'src/brand-new.ts', status: 'A' }),
      createMockChange({ path: 'src/quiet.ts', status: 'M' }),
    ]);
    const result = await aggregateSessionBriefing(
      makeSources(git, logger, runLog, {
        gitAnalyzer: makeAnalyzer({ files: [fm('src/hot.ts', 'high', 8.2, 40)] }),
      })
    );
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    const p = result.value.pendingChangeRisk!;
    expect(p.totalChanged).toBe(3);
    expect(p.hotspotCount).toBe(1);
    const byPath = Object.fromEntries(p.files.map((f) => [f.path, f]));
    expect(byPath['src/hot.ts']).toEqual({ path: 'src/hot.ts', status: 'M', churn: 40, volatility: 8.2, risk: 'high' });
    expect(byPath['src/brand-new.ts']).toEqual({ path: 'src/brand-new.ts', status: 'A', churn: null, volatility: null, risk: 'new' });
    expect(byPath['src/quiet.ts']).toEqual({ path: 'src/quiet.ts', status: 'M', churn: null, volatility: null, risk: 'cold' });
  });

  it('rename-normalizes the dirty path before joining to analytics', async () => {
    git.setAllChanges([createMockChange({ path: 'src/{old.ts => renamed.ts}', status: 'R' })]);
    const result = await aggregateSessionBriefing(
      makeSources(git, logger, runLog, {
        gitAnalyzer: makeAnalyzer({ files: [fm('src/renamed.ts', 'medium', 4, 12)] }),
      })
    );
    if (result.kind !== 'ok') throw new Error('expected ok');
    const p = result.value.pendingChangeRisk!;
    expect(p.files).toEqual([
      { path: 'src/renamed.ts', status: 'R', churn: 12, volatility: 4, risk: 'medium' },
    ]);
  });

  it('dedupes the same normalized path appearing staged and unstaged', async () => {
    git.setAllChanges([
      createMockChange({ path: 'src/dup.ts', status: 'M' }),
      createMockChange({ path: 'src/dup.ts', status: 'M' }),
    ]);
    const result = await aggregateSessionBriefing(makeSources(git, logger, runLog));
    if (result.kind !== 'ok') throw new Error('expected ok');
    const p = result.value.pendingChangeRisk!;
    expect(p.totalChanged).toBe(1);
    expect(p.files).toHaveLength(1);
  });

  it('sorts risk→volatility→path desc deterministically', async () => {
    git.setAllChanges([
      createMockChange({ path: 'src/b-med.ts', status: 'M' }),
      createMockChange({ path: 'src/a-med.ts', status: 'M' }),
      createMockChange({ path: 'src/hi.ts', status: 'M' }),
      createMockChange({ path: 'src/lo.ts', status: 'M' }),
    ]);
    const result = await aggregateSessionBriefing(
      makeSources(git, logger, runLog, {
        gitAnalyzer: makeAnalyzer({
          files: [
            fm('src/b-med.ts', 'medium', 3),
            fm('src/a-med.ts', 'medium', 3),
            fm('src/hi.ts', 'high', 1),
            fm('src/lo.ts', 'low', 9),
          ],
        }),
      })
    );
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect(result.value.pendingChangeRisk!.files.map((f) => f.path)).toEqual([
      'src/hi.ts', 'src/a-med.ts', 'src/b-med.ts', 'src/lo.ts',
    ]);
  });

  it('caps the table at PENDING_RISK.MAX_FILES but aggregates from the full pre-cap set', async () => {
    const n = PENDING_RISK.MAX_FILES + 2;
    git.setAllChanges(Array.from({ length: n }, (_, i) =>
      createMockChange({ path: `src/h${String(i).padStart(2, '0')}.ts`, status: 'M' })));
    const result = await aggregateSessionBriefing(
      makeSources(git, logger, runLog, {
        gitAnalyzer: makeAnalyzer({
          files: Array.from({ length: n }, (_, i) =>
            fm(`src/h${String(i).padStart(2, '0')}.ts`, 'high', n - i)),
        }),
      })
    );
    if (result.kind !== 'ok') throw new Error('expected ok');
    const p = result.value.pendingChangeRisk!;
    expect(p.totalChanged).toBe(n);
    expect(p.hotspotCount).toBe(n);
    expect(p.capped).toBe(true);
    expect(p.files).toHaveLength(PENDING_RISK.MAX_FILES);
  });

  it('raises a flag at PENDING_RISK.HOTSPOT_FLAG_THRESHOLD high-risk files', async () => {
    const n = PENDING_RISK.HOTSPOT_FLAG_THRESHOLD;
    git.setAllChanges(Array.from({ length: n }, (_, i) =>
      createMockChange({ path: `src/x${i}.ts`, status: 'M' })));
    const result = await aggregateSessionBriefing(
      makeSources(git, logger, runLog, {
        gitAnalyzer: makeAnalyzer({
          files: Array.from({ length: n }, (_, i) => fm(`src/x${i}.ts`, 'high', 5)),
        }),
      })
    );
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect(result.value.flags).toContain(`Modifying ${n} high-risk files`);
  });

  it('omits pendingChangeRisk when analytics is unavailable (fail-soft)', async () => {
    git.setAllChanges([createMockChange({ path: 'src/a.ts', status: 'M' })]);
    const brokenAnalyzer = { analyze: vi.fn().mockRejectedValue(new Error('no repo')) } as unknown as GitAnalyzer;
    const result = await aggregateSessionBriefing(
      makeSources(git, logger, runLog, { gitAnalyzer: brokenAnalyzer })
    );
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect(result.value.pendingChangeRisk).toBeUndefined();
  });

  // The session-briefing webview's FLAG_ANCHORS table couples to literal flag
  // prefixes emitted from this aggregator. The webview JS isn't importable here
  // (ES5 IIFE served as a static asset), so this test pins the contract from
  // the aggregator side: any rewording must be paired with a script.js update.
  it('emits flag strings the webview FLAG_ANCHORS table can match', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = await import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = await import('path');
    const src = fs.readFileSync(
      path.join(__dirname, '../src/domains/git/session-aggregator.ts'),
      'utf-8',
    );
    // Keep in sync with script.js FLAG_ANCHORS in session-briefing-ui/.
    const expectedFlagPrefixes = [
      'Recent run failures',
      'Modifying ',                          // "Modifying N high-risk files"
      'Hygiene: ',                           // dead/large hygiene flags
      'Large number of uncommitted files',
    ];
    for (const prefix of expectedFlagPrefixes) {
      expect(src).toContain(prefix);
    }
  });
});
