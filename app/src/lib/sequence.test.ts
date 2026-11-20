import { describe, it, expect } from 'vitest';
import { sequenceBlocks, classify } from './sequence';
import type { LayoutInfo } from './layout';
import type { Line } from './types';

function line(text: string, x0: number, x1: number, y: number, size = 10, font = 'F1'): Line {
  return { runs: [{ str: text, x: x0, y, w: x1 - x0, h: size, font, size }], x0, x1, y, text, size };
}

const single: LayoutInfo = {
  columns: 1,
  gutter: 300,
  confidence: 1,
  columnOf: () => 0,
  isSpanning: () => false,
};

const twoCol: LayoutInfo = {
  columns: 2,
  gutter: 300,
  confidence: 0.9,
  columnOf: (l) => (l.x0 < 300 ? 0 : 1),
  isSpanning: (l) => l.x0 < 296 && l.x1 > 304,
};

describe('sequenceBlocks — the core fix', () => {
  it('reads the whole left column before the right column', () => {
    // Content stream interleaves the columns; the fix must not.
    const lines: Line[] = [];
    for (let i = 0; i < 4; i++) {
      lines.push(line(`left ${i}`, 72, 280, 100 + i * 14));
      lines.push(line(`right ${i}`, 320, 520, 100 + i * 14));
    }
    const blocks = sequenceBlocks(lines, twoCol, { bodySize: 10 });
    const text = blocks.flatMap((b) => b.lines.map((l) => l.text)).join(' ');
    expect(text.indexOf('left 3')).toBeLessThan(text.indexOf('right 0'));
  });

  it('numbers blocks from 1 in order', () => {
    const lines = Array.from({ length: 6 }, (_, i) => line(`line ${i}`, 72, 520, 100 + i * 30));
    const blocks = sequenceBlocks(lines, single, { bodySize: 10 });
    expect(blocks.map((b) => b.order)).toEqual(blocks.map((_, i) => i + 1));
  });

  it('splits a block when the vertical gap is large', () => {
    const lines = [line('para one', 72, 520, 100), line('para two', 72, 520, 160)];
    const blocks = sequenceBlocks(lines, single, { bodySize: 10 });
    expect(blocks.length).toBe(2);
  });

  it('splits a block when font size changes', () => {
    const lines = [line('body text', 72, 520, 100, 10), line('BIG', 72, 200, 116, 20)];
    const blocks = sequenceBlocks(lines, single, { bodySize: 10 });
    expect(blocks.length).toBe(2);
  });

  it('keeps tightly-spaced lines of one paragraph together', () => {
    const lines = [
      line('first line of the paragraph', 72, 520, 100),
      line('second line of the paragraph', 72, 520, 113),
      line('third line of the paragraph', 72, 520, 126),
    ];
    const blocks = sequenceBlocks(lines, single, { bodySize: 10 });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].lines).toHaveLength(3);
  });

  it('never absorbs a numbered heading into the paragraph above it', () => {
    // The real-world case this guards: a section heading set at near-body size,
    // with normal leading, so neither the size delta nor the gap threshold fires.
    // "2 Method" sat 18.9pt below the previous line at 1pt larger and was being
    // swallowed into the paragraph, which cost the document its outline.
    const lines = [
      line('a line of ordinary body text that runs on', 72, 520, 100),
      line('another line of that same paragraph', 72, 520, 113),
      line('2 Method', 72, 520, 132, 11),
      line('the body of the method section', 72, 520, 145),
    ];
    const blocks = sequenceBlocks(lines, single, { bodySize: 10 });
    const heading = blocks.find((b) => b.lines[0].text === '2 Method');
    expect(heading).toBeDefined();
    expect(heading!.kind).toBe('heading');
    expect(heading!.lines).toHaveLength(1);
    // And the paragraph above it keeps only its own two lines.
    expect(blocks[0].lines).toHaveLength(2);
  });

  it('flags low-confidence blocks with a warning instead of staying silent', () => {
    const shaky: LayoutInfo = { ...twoCol, confidence: 0.2 };
    const lines: Line[] = [];
    for (let i = 0; i < 4; i++) {
      lines.push(line(`l${i}`, 72, 290, 100 + i * 14));
      lines.push(line(`r${i}`, 310, 520, 100 + i * 14));
    }
    const blocks = sequenceBlocks(lines, shaky, { bodySize: 10 });
    expect(blocks.some((b) => b.confidence < 0.6 && b.warning)).toBe(true);
  });

  it('puts a full-width title before both columns', () => {
    // The banding rule: a spanning line closes the band above it and must be
    // read before the column text that follows.
    const lines: Line[] = [
      line('A Full Width Title', 72, 540, 100, 18),
      line('left a', 72, 280, 140),
      line('left b', 72, 280, 154),
      line('right a', 320, 520, 140),
      line('right b', 320, 520, 154),
    ];
    const blocks = sequenceBlocks(lines, twoCol, { bodySize: 10 });
    expect(blocks[0].lines[0].text).toBe('A Full Width Title');
    const text = blocks.flatMap((b) => b.lines.map((l) => l.text)).join(' ');
    expect(text.indexOf('left b')).toBeLessThan(text.indexOf('right a'));
  });

  it('keeps a spanning line out of the surrounding paragraphs', () => {
    const lines: Line[] = [
      line('left a', 72, 280, 100),
      line('right a', 320, 520, 100),
      line('Table 1: Results across the corpus', 72, 540, 140),
      line('left b', 72, 280, 180),
      line('right b', 320, 520, 180),
    ];
    const blocks = sequenceBlocks(lines, twoCol, { bodySize: 10 });
    const caption = blocks.find((b) => b.lines[0].text.startsWith('Table 1'));
    expect(caption).toBeDefined();
    expect(caption!.lines).toHaveLength(1);
  });

  it('returns no blocks for no lines', () => {
    expect(sequenceBlocks([], single, { bodySize: 10 })).toEqual([]);
  });
});

describe('classify', () => {
  const opts = { bodySize: 10 };

  it('detects a numbered heading', () => {
    expect(classify([line('3.2 Attention', 72, 200, 100, 14)], opts)).toBe('heading');
  });

  it('detects a list item with a bullet', () => {
    expect(classify([line('• first point', 72, 300, 100)], opts)).toBe('list-item');
  });

  it('detects a numbered list item', () => {
    expect(classify([line('1. first point', 72, 300, 100)], opts)).toBe('list-item');
  });

  it('treats "1. Introduction" as a section heading, not a list item', () => {
    // The single most damaging misclassification we had: papers number their
    // sections exactly like an ordered list, so the export was turning every
    // top-level section into a <li> and destroying the outline.
    expect(classify([line('1. Introduction', 72, 300, 100, 12)], opts)).toBe('heading');
  });

  it('treats a modestly larger word as a heading, not body text', () => {
    // "Abstract" is 12pt against a 10pt body — a 1.2x step, below the old 1.25
    // threshold, so every Abstract in the corpus was read as body text.
    expect(classify([line('Abstract', 72, 300, 100, 12)], opts)).toBe('heading');
  });

  it('does not promote sub-body-size text to a heading', () => {
    // Figure axis labels are tiny; at 4.5pt against a 10pt body they are noise,
    // not structure, however short they are.
    expect(classify([line('0 shot', 72, 300, 100, 4.5)], opts)).toBe('paragraph');
  });

  it('does not promote a table row or a numbered paragraph line', () => {
    expect(classify([line('3 1 3 2 3 3', 72, 300, 100, 10)], opts)).toBe('paragraph');
    expect(
      classify([line('27 different datasets requires tuning 1782 different evalua-', 72, 300, 100, 10)], opts),
    ).toBe('paragraph');
  });

  it('keeps a title containing "and" as a heading', () => {
    expect(classify([line('Results and Discussion', 72, 300, 100, 12)], opts)).toBe('heading');
  });

  it('detects a figure caption', () => {
    expect(classify([line('Figure 2: Scaled Dot-Product Attention', 72, 400, 100)], opts)).toBe(
      'caption',
    );
  });

  it('detects a table caption', () => {
    expect(classify([line('Table 1: Results on WMT', 72, 400, 100)], opts)).toBe('caption');
  });

  it('treats ordinary prose as a paragraph', () => {
    expect(classify([line('We call our attention function scaled dot-product attention.', 72, 520, 100)], opts)).toBe(
      'paragraph',
    );
  });

  it('detects a large bold title as a heading', () => {
    expect(classify([line('Introduction', 72, 200, 100, 18, 'F1-Bold')], opts)).toBe('heading');
  });
});
