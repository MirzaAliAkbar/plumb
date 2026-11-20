import type { Line } from './types';

export interface LayoutInfo {
  /** number of columns detected for the page body */
  columns: number;
  /** x coordinate separating column 0 from column 1 */
  gutter: number;
  /** confidence 0..1 that the column detection is right */
  confidence: number;
  /** the column index a line belongs to */
  columnOf: (line: Line) => number;
  /** lines that span the gutter (titles, full-width figures, table rows) */
  isSpanning: (line: Line) => boolean;
}

/**
 * Detect the column structure of a page.
 *
 * The naive approach — "find a band of the page that no line touches" — fails on
 * exactly the documents that matter most: a full-width title, a spanning figure,
 * or a table row crosses the gutter, so the gutter is never empty and the page
 * reads as a single column.
 *
 * Instead we build a character-density profile across the page width and look
 * for the *thinnest* vertical slice in the middle band, relative to the body
 * density either side of it. A real gutter is a deep valley even when a title
 * jumps across it, because the title contributes very little area.
 *
 * Lines are then classified as left, right, or spanning. Sequencing is done
 * per horizontal band, so a spanning title correctly precedes both columns and a
 * spanning figure correctly separates the text above it from the text below.
 */
export function detectLayout(lines: Line[], pageWidth: number): LayoutInfo {
  if (lines.length < 6 || pageWidth <= 0) {
    return {
      columns: 1,
      gutter: pageWidth / 2,
      // Too little content to claim anything. Say so rather than assuming.
      confidence: 0.5,
      columnOf: () => 0,
      isSpanning: () => false,
    };
  }
  const single = (confidence: number): LayoutInfo => ({
    columns: 1,
    gutter: pageWidth / 2,
    confidence,
    columnOf: () => 0,
    isSpanning: () => false,
  });
  const BINS = 96;
  const binWidth = pageWidth / BINS;
  const density = new Array<number>(BINS).fill(0);

  for (const line of lines) {
    // Weight by covered area, not by line count: a title is one line but short,
    // and we do not want it to outweigh a column of body text.
    const span = Math.max(1, line.x1 - line.x0);
    const weight = line.text.length;
    const b0 = clampBin(line.x0 / binWidth, BINS);
    const b1 = clampBin(line.x1 / binWidth, BINS);
    for (let b = b0; b <= b1; b++) {
      const overlap = Math.min(binWidth, line.x1 - b * binWidth) - Math.max(0, line.x0 - b * binWidth);
      density[b] += weight * Math.max(0, Math.min(1, overlap / span)) / (b1 - b0 + 1);
    }
  }

  // Depth of a candidate gutter = how much thinner it is than its neighbourhood.
  const lo = Math.floor(BINS * 0.28);
  const hi = Math.ceil(BINS * 0.72);
  const maxDensity = Math.max(...density, 1);

  let bestScore = -1;
  let bestStart = -1;
  let bestLen = 0;

  for (let start = lo; start < hi; start++) {
    let sum = 0;
    for (let len = 1; len <= 10 && start + len <= hi; len++) {
      sum += density[start + len - 1];
      const mean = sum / len;
      const widthRatio = (len * binWidth) / pageWidth;
      if (widthRatio < 0.02) continue;

      // Compare against the shoulders either side of the candidate.
      const left = shoulderMean(density, start, -1, maxDensity);
      const right = shoulderMean(density, start + len, 1, maxDensity);
      const shoulder = (left + right) / 2;
      if (shoulder <= 0) continue;

      const depth = 1 - mean / shoulder;
      // Prefer deep valleys, and mildly prefer wider ones.
      const score = depth * 100 + widthRatio * 40;
      if (depth > 0.55 && score > bestScore) {
        bestScore = score;
        bestStart = start;
        bestLen = len;
      }
    }
  }

  if (bestStart < 0) return single(singleColumnConfidence(lines, pageWidth));

  const gutter = ((bestStart + bestLen / 2) * binWidth);
  const isSpanning = (line: Line) =>
    line.x0 < gutter - binWidth * 1.5 && line.x1 > gutter + binWidth * 1.5;
  const columnOf = (line: Line) => (line.x0 + line.x1) / 2 < gutter ? 0 : 1;

  let left = 0;
  let right = 0;
  let spanning = 0;
  for (const line of lines) {
    if (isSpanning(line)) {
      spanning++;
      continue;
    }
    if (columnOf(line) === 0) left++;
    else right++;
  }

  const minority = Math.min(left, right);
  const balance = minority / Math.max(1, left + right);
  const bodyLines = left + right;

  // A real two-column page has meaningful text on BOTH sides of the gutter.
  if (minority < 3 || balance < 0.12 || bodyLines < 6) {
    return single(singleColumnConfidence(lines, pageWidth));
  }

  const spanningRatio = spanning / lines.length;
  const confidence = clamp01(
    0.5 + Math.min(0.3, (bestScore / 100) * 0.35) + Math.min(0.2, balance) - spanningRatio * 0.15,
  );

  return {
    columns: 2,
    gutter,
    confidence,
    columnOf,
    isSpanning,
  };
}

/**
 * How sure are we that this page really has one column?
 *
 * Reporting 100% here would be dishonest: "I found no gutter" is not the same as
 * "I am certain there is no gutter". We earn confidence from evidence that the
 * page actually reads as a single flow — a consistent left edge, and lines that
 * extend across where a gutter would be.
 */
function singleColumnConfidence(lines: Line[], pageWidth: number): number {
  const starts = lines.map((l) => l.x0).sort((a, b) => a - b);
  const medianStart = starts[Math.floor(starts.length / 2)] ?? 0;
  const aligned = lines.filter((l) => Math.abs(l.x0 - medianStart) < 6).length / lines.length;

  const mid = pageWidth / 2;
  const reachingAcross = lines.filter((l) => l.x1 > mid + pageWidth * 0.12).length / lines.length;

  // Both signals point the same way on a genuine single-column page.
  return Math.max(0.5, Math.min(0.95, 0.45 + aligned * 0.3 + reachingAcross * 0.2));
}

/** Mean density in a window to one side of a position, ignoring empty bins. */function shoulderMean(
  density: number[],
  from: number,
  direction: number,
  maxDensity: number,
): number {
  const values: number[] = [];
  for (let i = 1; i <= 14; i++) {
    const idx = from + direction * i;
    if (idx < 0 || idx >= density.length) break;
    values.push(density[idx]);
  }
  if (!values.length) return 0;
  // Use a high percentile rather than the mean: the shoulder should represent
  // "how dense is the text here", and one gap inside a column must not drag it down.
  const sorted = values.sort((a, b) => a - b);
  const p = sorted[Math.floor(sorted.length * 0.75)];
  return Math.min(p, maxDensity);
}

function clampBin(v: number, bins: number): number {
  return Math.max(0, Math.min(bins - 1, Math.floor(v)));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Find running headers and footers: lines near the top or bottom of the page
 * that repeat across pages.
 *
 * Only lines that repeat on at least two pages are suppressed, and only inside
 * the header/footer band, so a genuine title or section heading is never eaten.
 */
export function findRunningElements(
  pagesLines: Line[][],
  pageHeight: number,
): Set<string> {
  const topBand = pageHeight * 0.085;
  const bottomBand = pageHeight * 0.925;

  const occurrences = new Map<string, number>();
  for (const lines of pagesLines) {
    const seen = new Set<string>();
    for (const line of lines) {
      const inBand = line.y < topBand || line.y > bottomBand;
      if (!inBand) continue;
      const key = runningKey(line);
      if (signature(line.text).length < 2) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
    }
  }

  const repeated = new Set<string>();
  for (const [key, count] of occurrences) {
    if (count >= 2) repeated.add(key);
  }

  // Single-page documents have no repetition to detect, but a running header or
  // a bare page number is still noise the reader should not hear. Fall back to
  // structural evidence, and be conservative: a running header is *small print*
  // in the margin, whereas a document title is large. Suppressing by position
  // alone would eat the title, which is the one line a reader most needs.
  if (pagesLines.length === 1) {
    const bodySize = modalSize(pagesLines[0]);
    for (const line of pagesLines[0]) {
      const atTop = line.y < pageHeight * 0.06;
      const atBottom = line.y > pageHeight * 0.945;
      if (!atTop && !atBottom) continue;
      if (signature(line.text).length < 2) continue;

      const isBareNumber = /^[\s\d\-–—|/]+$/.test(line.text);
      const isSmallPrint = line.size <= bodySize * 1.02;

      if (isBareNumber || isSmallPrint) repeated.add(runningKey(line));
    }
  }

  return repeated;
}

/**
 * Identity of a suppressible line.
 *
 * Text alone is not enough: a running header and the document title can carry
 * identical wording, and suppressing by text would remove the title too. The
 * font size is what distinguishes the 8pt header from the 18pt title.
 */
export function runningKey(line: Line): string {
  return `${signature(line.text)}|${Math.round(line.size * 2) / 2}`;
}

/** The character-weighted most common font size on a page. */
function modalSize(lines: Line[]): number {
  const weight = new Map<number, number>();
  for (const line of lines) {
    const key = Math.round(line.size * 2) / 2;
    weight.set(key, (weight.get(key) ?? 0) + line.text.length);
  }
  let best = 10;
  let bestWeight = -1;
  for (const [size, w] of weight) {
    if (w > bestWeight) {
      best = size;
      bestWeight = w;
    }
  }
  return best || 10;
}

/** Strip digits so "Page 3" and "Page 4" collapse to the same signature. */
export function signature(text: string): string {
  return text
    .toLowerCase()
    .replace(/[0-9]+/g, '#')
    .replace(/[^\p{L}#]+/gu, '')
    .slice(0, 60);
}
