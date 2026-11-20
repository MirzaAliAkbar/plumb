import type { Line, TextRun } from './types';

/**
 * Cluster text runs onto visual baselines.
 *
 * pdf.js returns runs in content-stream order, which is exactly the order we
 * cannot trust. Grouping by baseline is the first step back towards something
 * that reflects what a reader sees.
 */
export function clusterLines(runs: TextRun[], tolerance = 3.2): Line[] {
  const usable = runs.filter((r) => r.str.trim().length > 0);
  if (usable.length === 0) return [];

  // Sort by y (top to bottom in our coordinate space), then x, so clustering is
  // order-independent — this is what makes the result differ from the raw stream.
  const sorted = [...usable].sort((a, b) => a.y - b.y || a.x - b.x);

  const groups: TextRun[][] = [];
  for (const run of sorted) {
    const current = groups[groups.length - 1];
    if (current) {
      const anchor = current[0].y;
      // A run belongs to the current line if its baseline is within tolerance.
      if (Math.abs(run.y - anchor) <= tolerance) {
        current.push(run);
        continue;
      }
    }
    groups.push([run]);
  }

  // A shared baseline is not enough: in a two-column page, the last line of the
  // left column and the first line of the right column often sit at exactly the
  // same y. Merging them produces a "line" that spans the whole page and makes
  // every downstream column heuristic useless. Split on any gap much wider than
  // a normal word space.
  const lines: Line[] = [];
  for (const group of groups) {
    for (const segment of splitOnLargeGaps(group)) {
      const line = toLine(segment);
      if (line.text.length > 0) lines.push(line);
    }
  }
  return lines;
}

/**
 * Break a same-baseline group wherever the horizontal gap is too wide to be a
 * word space. The threshold adapts to font size so large type is not split.
 */
export function splitOnLargeGaps(group: TextRun[]): TextRun[][] {
  const ordered = [...group].sort((a, b) => a.x - b.x);
  if (ordered.length <= 1) return [ordered];

  const segments: TextRun[][] = [];
  let current: TextRun[] = [ordered[0]];

  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const run = ordered[i];
    const gap = run.x - (prev.x + prev.w);
    // A word space is well under half an em; a column gutter is one to two ems.
    // The multiplier used to be 1.8, which put the threshold at 18pt for 10pt
    // body text — wider than the 16pt gutter in a dense two-column paper, so the
    // two columns merged into one page-wide "spanning" line and the banding was
    // built on nonsense. 1.2em still leaves room for wide justified spacing and
    // for large type, whose word spaces scale with the font.
    const threshold = Math.max(10, Math.max(prev.size, run.size) * 1.2);
    if (gap > threshold) {
      segments.push(current);
      current = [run];
    } else {
      current.push(run);
    }
  }
  segments.push(current);
  return segments;
}

function toLine(group: TextRun[]): Line {
  const runs = [...group].sort((a, b) => a.x - b.x);
  const x0 = Math.min(...runs.map((r) => r.x));
  const x1 = Math.max(...runs.map((r) => r.x + r.w));
  // Dominant size by total character count is more stable than the max.
  const size = dominantSize(runs);
  return {
    runs,
    x0,
    x1,
    y: median(runs.map((r) => r.y)),
    text: joinRuns(runs),
    size,
  };
}

function dominantSize(runs: TextRun[]): number {
  const weight = new Map<number, number>();
  for (const r of runs) {
    const key = Math.round(r.size * 2) / 2;
    weight.set(key, (weight.get(key) ?? 0) + r.str.length);
  }
  let best = 0;
  let bestWeight = -1;
  for (const [size, w] of weight) {
    if (w > bestWeight) {
      best = size;
      bestWeight = w;
    }
  }
  return best;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Join runs into readable text.
 *
 * The hard part is hyphenation: PDFs break words across lines as "contextu-" +
 * "al", and a naive join produces "contextu- al". We drop the hyphen when both
 * sides look like word fragments.
 */
export function joinRuns(runs: TextRun[]): string {
  let out = '';
  for (let i = 0; i < runs.length; i++) {
    const piece = runs[i].str;
    if (i === 0) {
      out = piece;
      continue;
    }
    const prev = runs[i - 1];
    const gap = runs[i].x - (prev.x + prev.w);
    const needsSpace = gap > Math.max(1.2, prev.size * 0.18);
    out += needsSpace ? ' ' + piece : piece;
  }
  return normaliseWhitespace(out);
}

export function normaliseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Join lines into a paragraph, repairing hyphenated breaks.
 */
export function joinLines(lines: Line[]): string {
  let out = '';
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].text;
    if (i === 0) {
      out = text;
      continue;
    }
    const prevEndsHyphen = /[\p{L}]-$/u.test(out);
    const nextStartsLower = /^[\p{Ll}]/u.test(text);
    if (prevEndsHyphen && nextStartsLower) {
      out = out.slice(0, -1) + text; // drop the hyphen, keep the word whole
    } else {
      out += ' ' + text;
    }
  }
  return out.trim();
}
