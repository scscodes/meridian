import { describe, it, expect } from 'vitest';
import { parseConflictMarkers } from './conflicts.js';

describe('parseConflictMarkers', () => {
  it('parses a single conflict hunk', () => {
    const content = [
      'line 1',
      '<<<<<<< HEAD',
      'our change',
      '=======',
      'their change',
      '>>>>>>> feature-branch',
      'line after',
    ].join('\n');

    const hunks = parseConflictMarkers(content);
    expect(hunks).toHaveLength(1);
    expect(hunks[0]).toEqual({
      startLine: 2, // 1-based, at <<<<<<< line
      endLine: 6,   // 1-based, at >>>>>>> line
      ours: 'our change',
      theirs: 'their change',
      oursLabel: 'HEAD',
      theirsLabel: 'feature-branch',
    });
  });

  it('parses multiple conflict hunks', () => {
    const content = [
      '<<<<<<< HEAD',
      'ours 1',
      '=======',
      'theirs 1',
      '>>>>>>> branch-a',
      'clean line',
      '<<<<<<< HEAD',
      'ours 2',
      '=======',
      'theirs 2',
      '>>>>>>> branch-a',
    ].join('\n');

    const hunks = parseConflictMarkers(content);
    expect(hunks).toHaveLength(2);
    expect(hunks[0].ours).toBe('ours 1');
    expect(hunks[0].theirs).toBe('theirs 1');
    expect(hunks[1].ours).toBe('ours 2');
    expect(hunks[1].theirs).toBe('theirs 2');
  });

  it('handles multi-line content in each side', () => {
    const content = [
      '<<<<<<< HEAD',
      'line a',
      'line b',
      'line c',
      '=======',
      'line x',
      'line y',
      '>>>>>>> other',
    ].join('\n');

    const hunks = parseConflictMarkers(content);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].ours).toBe('line a\nline b\nline c');
    expect(hunks[0].theirs).toBe('line x\nline y');
  });

  it('handles empty ours side', () => {
    const content = [
      '<<<<<<< HEAD',
      '=======',
      'their addition',
      '>>>>>>> feature',
    ].join('\n');

    const hunks = parseConflictMarkers(content);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].ours).toBe('');
    expect(hunks[0].theirs).toBe('their addition');
  });

  it('handles empty theirs side', () => {
    const content = [
      '<<<<<<< HEAD',
      'our content',
      '=======',
      '>>>>>>> feature',
    ].join('\n');

    const hunks = parseConflictMarkers(content);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].ours).toBe('our content');
    expect(hunks[0].theirs).toBe('');
  });

  it('handles both sides empty', () => {
    const content = [
      '<<<<<<< HEAD',
      '=======',
      '>>>>>>> feature',
    ].join('\n');

    const hunks = parseConflictMarkers(content);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].ours).toBe('');
    expect(hunks[0].theirs).toBe('');
  });

  it('returns empty array for no conflict markers', () => {
    const content = 'just normal code\nno conflicts here\n';
    const hunks = parseConflictMarkers(content);
    expect(hunks).toHaveLength(0);
  });

  it('extracts labels from markers', () => {
    const content = [
      '<<<<<<< abc123 (main)',
      'ours',
      '=======',
      'theirs',
      '>>>>>>> def456 (feature/login)',
    ].join('\n');

    const hunks = parseConflictMarkers(content);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].oursLabel).toBe('abc123 (main)');
    expect(hunks[0].theirsLabel).toBe('def456 (feature/login)');
  });

  it('handles missing separator gracefully', () => {
    const content = [
      '<<<<<<< HEAD',
      'orphan content',
      '>>>>>>> feature',
    ].join('\n');

    // No ======= separator — should not produce a valid hunk
    const hunks = parseConflictMarkers(content);
    expect(hunks).toHaveLength(0);
  });

  it('correctly reports line numbers', () => {
    const content = [
      'line 1',          // 0
      'line 2',          // 1
      'line 3',          // 2
      '<<<<<<< HEAD',    // 3 → startLine = 4 (1-based)
      'ours',            // 4
      '=======',         // 5
      'theirs',          // 6
      '>>>>>>> feat',    // 7 → endLine = 8 (1-based)
      'line after',      // 8
    ].join('\n');

    const hunks = parseConflictMarkers(content);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].startLine).toBe(4);
    expect(hunks[0].endLine).toBe(8);
  });
});
