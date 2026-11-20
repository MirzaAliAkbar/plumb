import { describe, it, expect } from 'vitest';
import { detectLayout, findRunningElements, runningKey, signature } from './layout';
import type { Line } from './types';

function line(text: string, x0: number, x1: number, y: number, size = 10): Line {
  return { runs: [], x0, x1, y, text, size };
}

const W = 600;

describe('detectLayout', () => {
  it('reports a single column for a single-column page', () => {
    const lines = Array.from({ length: 20 }, (_, i) =>
      line(`paragraph text number ${i}`, 72, 528, 100 + i * 14),
    );
    const layout = detectLayout(lines, W);
    expect(layout.columns).toBe(1);
  });

  it('detects a genuine two-column page with a wide gutter', () => {
    const lines: Line[] = [];
    for (let i = 0; i < 12; i++) {
      lines.push(line(`left column line ${i}`, 72, 280, 100 + i * 14));
      lines.push(line(`right column line ${i}`, 320, 528, 100 + i * 14));
    }
    const layout = detectLayout(lines, W);
    expect(layout.columns).toBe(2);
    expect(layout.gutter).toBeGreaterThan(280);
    expect(layout.gutter).toBeLessThan(320);
    expect(layout.confidence).toBeGreaterThan(0.6);
  });

  it('assigns lines to the correct column', () => {
    const lines: Line[] = [];
    for (let i = 0; i < 12; i++) {
      lines.push(line(`L${i}`, 72, 280, 100 + i * 14));
      lines.push(line(`R${i}`, 320, 528, 100 + i * 14));
    }
    const layout = detectLayout(lines, W);
    expect(layout.columnOf(line('L', 100, 250, 200))).toBe(0);
    expect(layout.columnOf(line('R', 340, 520, 200))).toBe(1);
  });

  it('does not invent a second column when one side is nearly empty', () => {
    const lines = [
      ...Array.from({ length: 18 }, (_, i) => line(`body ${i}`, 72, 400, 100 + i * 14)),
      line('a single stray line', 450, 520, 110),
    ];
    expect(detectLayout(lines, W).columns).toBe(1);
  });

  it('rejects a split when too much text spans the gutter', () => {
    // Two groups of starts, but every line also crosses the middle: a table.
    const lines = Array.from({ length: 20 }, (_, i) =>
      line(`wide row ${i}`, 72 + (i % 2) * 250, 560, 100 + i * 14),
    );
    expect(detectLayout(lines, W).columns).toBe(1);
  });

  it('returns single column for very few lines', () => {
    expect(detectLayout([line('a', 72, 500, 100), line('b', 72, 500, 114)], W).columns).toBe(1);
  });

  it('always gives a confidence in [0,1]', () => {
    const lines = Array.from({ length: 30 }, (_, i) =>
      line(`x${i}`, 72 + (i % 2) * 250, 280 + (i % 2) * 250, 100 + i * 14),
    );
    const c = detectLayout(lines, W).confidence;
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(1);
  });

  it('does not claim certainty just because it found no gutter', () => {
    // A page whose lines have ragged starts and stop short of the middle is not
    // evidence of a confident single column — it is evidence of uncertainty.
    const ragged = Array.from({ length: 20 }, (_, i) =>
      line(`word ${i}`, 72 + (i % 5) * 30, 200 + (i % 4) * 90, 100 + i * 14),
    );
    expect(detectLayout(ragged, W).confidence).toBeLessThan(1);
  });

  it('is confident about a clean single-column page', () => {
    const clean = Array.from({ length: 20 }, (_, i) =>
      line(`paragraph line ${i}`, 72, 540, 100 + i * 14),
    );
    const c = detectLayout(clean, W).confidence;
    expect(c).toBeGreaterThan(0.8);
    expect(c).toBeLessThanOrEqual(0.95);
  });
});

describe('findRunningElements', () => {
  it('suppresses a header that repeats across pages', () => {
    const pages = [
      [line('Journal of Testing 2026', 72, 400, 20, 8), line('body text here', 72, 400, 200)],
      [line('Journal of Testing 2026', 72, 400, 20, 8), line('more body text', 72, 400, 200)],
    ];
    const repeated = findRunningElements(pages, 792);
    expect(repeated.has(runningKey(line('Journal of Testing 2026', 72, 400, 20, 8)))).toBe(true);
  });

  it('does not suppress a title that shares wording with the running header', () => {
    // The running header and the document title can carry identical text. Only
    // the size distinguishes them, and eating the title would be a real loss.
    const pages = [
      [
        line('Reading Order', 72, 300, 20, 8),
        line('Reading Order', 72, 500, 90, 18),
        line('body text', 72, 500, 200, 10),
      ],
      [
        line('Reading Order', 72, 300, 20, 8),
        line('more body text', 72, 500, 90, 10),
      ],
    ];
    const repeated = findRunningElements(pages, 792);
    expect(repeated.has(runningKey(line('Reading Order', 72, 300, 20, 8)))).toBe(true);
    expect(repeated.has(runningKey(line('Reading Order', 72, 500, 90, 18)))).toBe(false);
  });

  it('suppresses a small-print header on a single-page document', () => {
    const pages = [[line('Some Journal', 72, 300, 30, 8), line('body', 72, 500, 200, 10)]];
    const repeated = findRunningElements(pages, 792);
    expect(repeated.has(runningKey(line('Some Journal', 72, 300, 30, 8)))).toBe(true);
  });

  it('keeps a large title on a single-page document', () => {
    const pages = [[line('A Big Title', 72, 400, 60, 18), line('body', 72, 500, 200, 10)]];
    const repeated = findRunningElements(pages, 792);
    expect(repeated.has(runningKey(line('A Big Title', 72, 400, 60, 18)))).toBe(false);
  });

  it('collapses page numbers to one signature', () => {
    expect(signature('Page 3')).toBe(signature('Page 47'));
  });

  it('never suppresses a one-off title', () => {
    const pages = [
      [line('A Unique Paper Title', 72, 400, 20)],
      [line('Different Content Entirely', 72, 400, 20)],
    ];
    const repeated = findRunningElements(pages, 792);
    expect(repeated.has(runningKey(line('A Unique Paper Title', 72, 400, 20)))).toBe(false);
  });

  it('ignores content in the middle of the page', () => {
    const pages = [
      [line('repeated body sentence', 72, 400, 400)],
      [line('repeated body sentence', 72, 400, 400)],
    ];
    expect(findRunningElements(pages, 792).size).toBe(0);
  });
});
