import { describe, it, expect } from 'vitest';
import { clusterLines, joinLines, joinRuns, normaliseWhitespace } from './lines';
import type { TextRun } from './types';

function run(str: string, x: number, y: number, size = 10, w = str.length * size * 0.5): TextRun {
  return { str, x, y, w, h: size, font: 'F1', size };
}

describe('clusterLines', () => {
  it('groups runs sharing a baseline and orders them left to right', () => {
    const runs = [run('world', 42, 100), run('hello', 10, 100), run('second', 10, 120)];
    const lines = clusterLines(runs);
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe('hello world');
    expect(lines[1].text).toBe('second');
  });

  it('splits a shared baseline at a column-sized gap', () => {
    // The last line of a left column and the first of a right column often share
    // a baseline. Merging them would make column detection impossible.
    const runs = [run('end of left column', 72, 200, 10, 80), run('start of right', 330, 200, 10, 70)];
    const lines = clusterLines(runs);
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe('end of left column');
    expect(lines[1].text).toBe('start of right');
  });

  it('is independent of input order (this is the whole point)', () => {
    const runs = [run('c', 10, 140), run('a', 10, 100), run('b', 10, 120)];
    const forward = clusterLines(runs).map((l) => l.text);
    const reversed = clusterLines([...runs].reverse()).map((l) => l.text);
    expect(forward).toEqual(['a', 'b', 'c']);
    expect(reversed).toEqual(forward);
  });

  it('does not merge lines that are merely close', () => {
    const runs = [run('one', 10, 100, 10), run('two', 10, 108, 10)];
    expect(clusterLines(runs)).toHaveLength(2);
  });

  it('tolerates sub-pixel baseline jitter', () => {
    const runs = [run('a', 10, 100, 10), run('b', 18, 101.5, 10)];
    expect(clusterLines(runs)).toHaveLength(1);
  });

  it('drops whitespace-only runs', () => {
    const runs = [run('   ', 10, 100), run('real', 10, 100)];
    const lines = clusterLines(runs);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('real');
  });

  it('returns nothing for empty input', () => {
    expect(clusterLines([])).toEqual([]);
  });

  it('computes the line extent from the runs', () => {
    const lines = clusterLines([run('abc', 10, 100, 10, 30), run('de', 45, 100, 10, 10)]);
    expect(lines[0].x0).toBe(10);
    expect(lines[0].x1).toBe(55);
  });
});

describe('joinRuns', () => {
  it('inserts a space when runs are visually separated', () => {
    expect(joinRuns([run('hello', 0, 0, 10, 25), run('world', 40, 0, 10, 25)])).toBe(
      'hello world',
    );
  });

  it('does not insert a space inside a word split across runs', () => {
    expect(joinRuns([run('hel', 0, 0, 10, 15), run('lo', 15.2, 0, 10, 10)])).toBe('hello');
  });

  it('collapses repeated whitespace', () => {
    expect(normaliseWhitespace('a    b\n\tc')).toBe('a b c');
  });
});

describe('joinLines', () => {
  it('repairs hyphenated word breaks', () => {
    const lines = [
      { runs: [], x0: 0, x1: 0, y: 0, text: 'contextu-', size: 10 },
      { runs: [], x0: 0, x1: 0, y: 12, text: 'al shift', size: 10 },
    ];
    expect(joinLines(lines)).toBe('contextual shift');
  });

  it('keeps a real hyphen before a capitalised word', () => {
    const lines = [
      { runs: [], x0: 0, x1: 0, y: 0, text: 'state-of-', size: 10 },
      { runs: [], x0: 0, x1: 0, y: 12, text: 'The-art', size: 10 },
    ];
    expect(joinLines(lines)).toBe('state-of- The-art');
  });

  it('joins ordinary lines with a space', () => {
    const lines = [
      { runs: [], x0: 0, x1: 0, y: 0, text: 'first line', size: 10 },
      { runs: [], x0: 0, x1: 0, y: 12, text: 'second line', size: 10 },
    ];
    expect(joinLines(lines)).toBe('first line second line');
  });

  it('handles a single line', () => {
    expect(joinLines([{ runs: [], x0: 0, x1: 0, y: 0, text: 'only', size: 10 }])).toBe('only');
  });
});
