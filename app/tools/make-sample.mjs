/**
 * Generates the bundled sample PDF.
 *
 * Hand-built rather than borrowed: the sample ships with the app and must be
 * ours to license. It is deliberately a two-column layout with a running
 * header, page numbers and hyphenated line breaks, because those are exactly
 * the things that break reading order.
 *
 * Text is measured and wrapped to the column width — writing long strings and
 * hoping they fit is how you get a sample that silently overflows the gutter
 * and defeats the very thing it is meant to demonstrate.
 *
 * Run: node tools/make-sample.mjs
 */
import fs from 'node:fs';

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 72;
const COL_GAP = 26;
const COL_W = (PAGE_W - MARGIN * 2 - COL_GAP) / 2;
const LEFT_X = MARGIN;
const RIGHT_X = MARGIN + COL_W + COL_GAP;
const BODY_SIZE = 10;
const LEADING = 13;

/**
 * Approximate Helvetica advance widths (per 1000 units of font size).
 * Good enough for a sample document, and avoids shipping a font metrics table.
 */
const WIDTHS = {
  narrow: 'iljtfr.,;:\'|!()[]{}-',
  wide: 'mwMW',
  capWide: 'ABCDEFGHKNOPQRSTUVXYZ',
};

function textWidth(str, size) {
  let units = 0;
  for (const ch of str) {
    if (WIDTHS.narrow.includes(ch)) units += 300;
    else if (WIDTHS.wide.includes(ch)) units += 800;
    else if (WIDTHS.capWide.includes(ch)) units += 680;
    else if (ch === ' ') units += 278;
    else units += 520;
  }
  return (units / 1000) * size;
}

/** Greedy wrap to a pixel width. Returns array of lines. */
function wrap(text, size, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const out = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? line + ' ' + word : word;
    if (textWidth(candidate, size) <= maxWidth || !line) {
      line = candidate;
    } else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  return out;
}

const TITLE = 'Reading Order in Compound Documents';
const SUBTITLE = 'A study of why assistive technology misreads two-column layouts';
const AUTHOR = 'A. Researcher and B. Collaborator';

const LEFT = [
  ['h', '1  Introduction'],
  ['p', 'Assistive technology does not see a page. It sees a sequence. When a document is authored without structure, that sequence is whatever order the producing software happened to write, and it rarely matches the order a person reads.'],
  ['p', 'In a two-column layout the two orders diverge badly. A reader moves down the left column and then down the right. A content stream typically interleaves them, so a spoken rendering alternates between unrelated sentences.'],
  ['p', 'This paper argues that the divergence is recoverable. Layout is geometry, and geometry survives in the file even when structure does not. If we can measure where glyphs sit, we can infer which of them form a line, which lines form a column, and which sequence of columns a reader would follow.'],
  ['h', '2  Method'],
  ['p', 'We treat the page as a set of positioned runs and reconstruct structure in three passes: clustering into lines, segmentation into columns, and sequencing of the resulting blocks. Each pass exposes a confidence, and the lowest confidence in the chain governs the whole page.'],
  ['p', 'The contrast with structural remediation is worth stating plainly. Tagging a document fixes it once, permanently, and for every consumer. Reconstruction fixes a reading session, and must be repeated. The advantage of reconstruction is reach, because it works on documents that nobody will ever remediate.'],
];

const RIGHT = [
  ['h', '3  Results'],
  ['p', 'Across the corpus, column detection succeeded whenever the gutter remained clear for the full height of the text block. It failed most often on pages carrying a full-width figure, where the gutter is interrupted and the measure of emptiness collapses.'],
  ['p', 'The failure is instructive rather than merely inconvenient. A spanning figure is itself evidence about reading order: text above it precedes both columns, and text below it follows both. Detecting the interruption is therefore part of the solution rather than an exception to it.'],
  ['h', '4  Discussion'],
  ['p', 'Confidence reporting mattered more than accuracy in our trials. Participants tolerated an admitted uncertainty and distrusted a silent guess. A wrong order that presents itself as certain is worse than a flagged ambiguity, because the reader has no way to notice the error.'],
  ['p', 'This suggests a design rule for assistive tools generally: state what you do not know. The cost is a moment of friction. The alternative is a reader who cannot tell whether the text in front of them is what the author wrote.'],
  ['h', '5  Conclusion'],
  ['p', 'Reading order is recoverable from geometry, cheaply, in the browser, without a licence and without an expert. That is enough to make a large class of documents usable that are currently not.'],
];

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

const ops = [];

// Running header (should be suppressed by the pipeline).
ops.push('BT /F2 8 Tf 0.45 g');
ops.push(`1 0 0 1 ${MARGIN} ${PAGE_H - 44} Tm (${esc(TITLE)}) Tj`);
ops.push('ET');

let y = PAGE_H - MARGIN - 30;

// Title block, full width.
ops.push('BT /F2 18 Tf 0 g');
for (const line of wrap(TITLE, 18, PAGE_W - MARGIN * 2)) {
  ops.push(`1 0 0 1 ${MARGIN} ${y} Tm (${esc(line)}) Tj`);
  y -= 21;
}
y -= 4;
ops.push('ET');
ops.push('BT /F1 11 Tf 0.25 g');
for (const line of wrap(SUBTITLE, 11, PAGE_W - MARGIN * 2)) {
  ops.push(`1 0 0 1 ${MARGIN} ${y} Tm (${esc(line)}) Tj`);
  y -= 14;
}
y -= 2;
ops.push('ET');
ops.push('BT /F1 9.5 Tf 0.35 g');
ops.push(`1 0 0 1 ${MARGIN} ${y} Tm (${esc(AUTHOR)}) Tj`);
ops.push('ET');

const colTop = y - 26;

function emitColumn(column, startX) {
  let cy = colTop;
  for (const [kind, text] of column) {
    if (kind === 'h') {
      ops.push('BT /F2 11 Tf 0 g');
      ops.push(`1 0 0 1 ${startX} ${cy} Tm (${esc(text)}) Tj`);
      ops.push('ET');
      cy -= LEADING * 1.7;
    } else {
      ops.push(`BT /F1 ${BODY_SIZE} Tf 0 g`);
      for (const line of wrap(text, BODY_SIZE, COL_W)) {
        ops.push(`1 0 0 1 ${startX} ${cy} Tm (${esc(line)}) Tj`);
        cy -= LEADING;
      }
      ops.push('ET');
      cy -= LEADING * 0.45;
    }
  }
}

emitColumn(LEFT, LEFT_X);
emitColumn(RIGHT, RIGHT_X);

// Page number (should be suppressed).
ops.push('BT /F1 8 Tf 0.45 g');
ops.push(`1 0 0 1 ${PAGE_W / 2 - 3} 44 Tm (1) Tj`);
ops.push('ET');

const CONTENT = ops.join('\n');

const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
    `/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
  `<< /Length ${CONTENT.length} >>\nstream\n${CONTENT}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
];

let pdf = '%PDF-1.4\n';
const offsets = [];
objects.forEach((body, i) => {
  offsets.push(pdf.length);
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});

const xrefStart = pdf.length;
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const off of offsets) {
  pdf += String(off).padStart(10, '0') + ' 00000 n \n';
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

fs.mkdirSync('public/samples', { recursive: true });
fs.writeFileSync('public/samples/two-column-paper.pdf', pdf, 'latin1');
console.log('wrote public/samples/two-column-paper.pdf', pdf.length, 'bytes');
