import type { Block, BlockKind, Line } from './types';
import type { LayoutInfo } from './layout';

/**
 * Sequence lines into reading-ordered blocks and classify them.
 *
 * This is the heart of the product, and the part that a naive implementation
 * gets wrong.
 *
 * The key idea is *bands*. A line that spans the gutter — a title, a full-width
 * figure caption, a table row — breaks the page into horizontal bands. Within a
 * band the reading order is "all of the left column, then all of the right
 * column". Across bands it is top to bottom. Reading straight down each column
 * for the whole page would put the title in the middle of the left column;
 * reading strictly by y would interleave the columns. Both are wrong.
 */

// A single capital letter followed by a period is an author initial far more
// often than it is a list marker, so list markers must be a real bullet, a
// bracketed number, or a number followed by punctuation.
const LIST_PREFIX = /^([•·‣▪◦*\-–—]|\(\d{1,2}[.)]|\d{1,2}[.)]|\(?[ivxlc]{1,5}[.)])\s+/u;
const CAPTION_PREFIX = /^(figure|fig\.|table|listing|algorithm|exhibit)\s*\d+/iu;
// A section number: "1", "1.", "3.1", "IV." — optionally followed by a dot.
const HEADING_NUMBER = /^((\d{1,2}(\.\d{1,2})*\.?)|([IVXLC]{1,5}\.))\s+\p{L}/u;
// Sentence punctuation inside a candidate heading means it is prose, not a title.
// Deliberately narrow: banning common words like "and" would reject real titles
// such as "Results and Discussion".
const PROSE_HINT = /[,;]\s|[.!?]\s/u;
const CODE_HINT =
  /[{};=<>]|^\s{2,}\S|\b(function|const|let|var|class|import|return|def|public|private)\b/u;

export interface SequenceOptions {
  /** median body font size, used to spot headings */
  bodySize: number;
}

interface Band {
  spanning: Line[];
  left: Line[];
  right: Line[];
}

export function sequenceBlocks(
  lines: Line[],
  layout: LayoutInfo,
  opts: SequenceOptions,
): Block[] {
  if (lines.length === 0) return [];

  const ordered = orderLines(lines, layout);
  const blocks = groupIntoBlocks(ordered, layout, opts);

  blocks.forEach((b, i) => {
    b.order = i + 1;
    if (b.confidence < 0.6) {
      b.warning =
        layout.columns === 2 && layout.confidence < 0.75
          ? 'Column split uncertain on this page — check this block'
          : 'Grouping uncertain — check this block';
    }
  });

  return blocks;
}

/**
 * Produce the line sequence a human would read.
 */
export function orderLines(lines: Line[], layout: LayoutInfo): Line[] {
  if (layout.columns === 1) {
    return [...lines].sort((a, b) => a.y - b.y || a.x0 - b.x0);
  }

  const sorted = [...lines].sort((a, b) => a.y - b.y || a.x0 - b.x0);
  const bands: Band[] = [];
  let current: Band = { spanning: [], left: [], right: [] };

  const pushBand = () => {
    if (current.spanning.length || current.left.length || current.right.length) {
      bands.push(current);
    }
    current = { spanning: [], left: [], right: [] };
  };

  for (const line of sorted) {
    if (layout.isSpanning(line)) {
      // A spanning line closes the current band.
      pushBand();
      current.spanning.push(line);
    } else if (layout.columnOf(line) === 0) {
      current.left.push(line);
    } else {
      current.right.push(line);
    }
  }
  pushBand();

  const out: Line[] = [];
  for (const band of bands) {
    // Spanning content comes first within its band, then left column, then right.
    out.push(...band.spanning);
    out.push(...band.left.sort((a, b) => a.y - b.y || a.x0 - b.x0));
    out.push(...band.right.sort((a, b) => a.y - b.y || a.x0 - b.x0));
  }
  return out;
}

function groupIntoBlocks(
  ordered: Line[],
  layout: LayoutInfo,
  opts: SequenceOptions,
): Block[] {
  const blocks: Block[] = [];
  let current: Line[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const kind = classify(current, opts);
    blocks.push({
      kind,
      lines: current,
      order: blocks.length + 1,
      confidence: blockConfidence(current, layout, kind, opts),
      column: layout.columns === 2 ? layout.columnOf(current[0]) : 0,
    });
    current = [];
  };

  for (let i = 0; i < ordered.length; i++) {
    const line = ordered[i];
    if (current.length === 0) {
      current = [line];
      continue;
    }
    const prev = current[current.length - 1];

    // A spanning line always stands alone as its own block; it is a title or a
    // caption, and merging it into a paragraph would be wrong.
    if (layout.isSpanning(line) !== layout.isSpanning(prev)) {
      flush();
      current = [line];
      continue;
    }

    const gap = line.y - prev.y;
    const sameColumn = layout.columns === 1 || layout.isSpanning(line) || layout.columnOf(line) === layout.columnOf(prev);
    const sizeChanged = Math.abs(line.size - prev.size) > Math.max(1.5, prev.size * 0.18);
    const bigGap = gap > Math.max(prev.size * 1.9, 16);
    const backwards = line.y < prev.y - 2; // a new band started

    // A line that is a heading (or caption) on its own must never be absorbed
    // into the paragraph above it. Judging that per-line is more reliable than
    // the gap and size heuristics, which a numbered heading with normal leading
    // and near-body type slips past: "2 Method" is 18.9pt below the previous
    // line at 1pt larger, so both thresholds miss and it joins the paragraph.
    const kindAlone = classify([line], opts);
    const startsOwnBlock = kindAlone === 'heading' || kindAlone === 'caption';

    // The same rule from the other side: a block that is already a heading must
    // not swallow the body text beneath it. It may still take a second line, but
    // only when that line is heading-like too, which is how a wrapped title
    // survives while "2 Method" does not eat its own section.
    const currentIsHeading =
      current.length === 1 &&
      (classify(current, opts) === 'heading' || classify(current, opts) === 'caption');
    const headingEndsHere = currentIsHeading && !startsOwnBlock;

    if (!sameColumn || sizeChanged || bigGap || backwards || startsOwnBlock || headingEndsHere) {
      flush();
      current = [line];
    } else {
      current.push(line);
    }
  }
  flush();

  return blocks;
}

export function classify(lines: Line[], opts: SequenceOptions): BlockKind {
  const first = lines[0];
  const text = first.text;
  const size = first.size;
  const isBoldish = first.runs.some((r) => /bold|black|heavy/i.test(r.font));
  const short = text.length < 90 && lines.length <= 2;
  // Nothing smaller than body text is a heading. Real section headings are set
  // at or above body size; sub-body type in a figure or a table footnote is not.
  const isSmallPrint = size < opts.bodySize * 0.95;
  // "Larger than body" has to be a modest multiple: a section heading is often
  // only ~1.2x body (12pt against 10pt), and a 1.25 threshold silently lost
  // every "Abstract" in the corpus while keeping 18pt titles.
  const isLarger = size >= opts.bodySize * 1.08;

  const words = text.split(/\s+/).filter(Boolean).length;
  // Strip a leading section number before looking for sentence punctuation: the
  // dot in "1. Introduction" is part of the number, not the end of a sentence.
  const stripped = text.replace(/^\d{1,2}(\.\d{1,2})*\.?\s+/, '').replace(/^[IVXLC]{1,5}\.\s+/, '');
  const prose = PROSE_HINT.test(stripped);
  const titleish = short && words <= 6 && !prose && stripped.split(/\s+/).length >= 1;

  if (CAPTION_PREFIX.test(text)) return 'caption';

  // Numbered section heading, checked BEFORE the list rule: "1. Introduction"
  // also matches the list-marker pattern, and turning a paper's top-level
  // sections into bullet points destroys the outline the export exists to
  // provide. This also catches "3.1 Encoder and Decoder Stacks", which is set at
  // body size and is only identifiable by its numbering.
  //
  // "1. Introduction" and "1. first point" are structurally identical, so the
  // discriminator is capitalisation: a section title starts with a capital
  // letter, a prose list entry does not.
  const afterNumber = stripped.charAt(0);
  const titleCase = afterNumber !== '' && afterNumber === afterNumber.toUpperCase();
  if (titleish && !isSmallPrint && titleCase && HEADING_NUMBER.test(text)) return 'heading';

  // Unnumbered heading: "Abstract", "References", "Results and Discussion".
  // Needs the size or weight signal, because "the" alone would otherwise
  // promote a short prose line.
  if (titleish && !isSmallPrint && (isLarger || (isBoldish && !/[.!?]$/.test(text)))) {
    return 'heading';
  }

  if (LIST_PREFIX.test(text)) return 'list-item';
  if (CODE_HINT.test(text) && lines.length <= 6 && averageLineLength(lines) < 60) {
    return 'code';
  }
  return 'paragraph';
}

function averageLineLength(lines: Line[]): number {
  return lines.reduce((a, l) => a + l.text.length, 0) / Math.max(1, lines.length);
}

/**
 * Confidence is built from concrete, explainable signals — not a vibe.
 */
export function blockConfidence(
  lines: Line[],
  layout: LayoutInfo,
  kind: BlockKind,
  opts: SequenceOptions,
): number {
  let c = 1;

  if (layout.columns === 2) {
    // A block mixing spanning and non-spanning lines means the banding is muddy.
    const spanning = lines.filter((l) => layout.isSpanning(l)).length;
    if (spanning > 0 && spanning < lines.length) c -= 0.25;
  }

  // Scale by layout confidence in every case: two independent uncertainties
  // compound, and a page where we could not see a gutter is not a sure page.
  c *= 0.3 + 0.7 * layout.confidence;

  if (kind === 'paragraph' && lines.length >= 3) {
    const lefts = lines.map((l) => l.x0);
    const spread = Math.max(...lefts) - Math.min(...lefts);
    const medianSize = lines[0].size || 10;
    if (spread > medianSize * 3.5) c -= 0.2;
  }

  if (kind === 'paragraph') {
    const sizes = lines.map((l) => l.size);
    const churn = Math.max(...sizes) - Math.min(...sizes);
    if (churn > opts.bodySize * 0.5) c -= 0.15;
  }

  return Math.max(0, Math.min(1, c));
}
