/**
 * Generates the bundled sample PDF.
 *
 * The sample exists to make one failure visible: a two-column page whose
 * content stream alternates between columns. That is the order a screen reader
 * follows, and it is why the page sounds like nonsense even though every word
 * is correct.
 *
 * The visual layout is deliberately ordinary. The stream order is not: body
 * lines are written row by row, left then right, so the raw order really does
 * cross the gutter. Absolute text positions mean emission order cannot change
 * what the page looks like.
 *
 * Page 2 puts a full-width caption between two column bands, so the sample also
 * exercises the band rule rather than only the gutter detector.
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
  // The table above is approximate; real Helvetica runs a few percent wider.
  // Bias the measure so wrapped lines stop short of the column edge instead of
  // overrunning it in the rendered page.
  return (units / 1000) * size * 1.07;
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

const PAGE_ONE = {
  title: true,
  left: [
    ['h', '1  Introduction'],
    [
      'p',
      'Assistive technology does not see a page. It sees a sequence. When a document is authored without structure, that sequence is whatever order the producing software happened to write, and it rarely matches the order a person reads.',
    ],
    [
      'p',
      'In a two-column layout the two orders diverge badly. A reader moves down the left column and then down the right. A content stream typically interleaves them, so a spoken rendering alternates between unrelated sentences.',
    ],
    [
      'p',
      'This paper argues that the divergence is recoverable. Layout is geometry, and geometry survives in the file even when structure does not. If we can measure where glyphs sit, we can infer which of them form a line, which lines form a column, and which sequence of columns a reader would follow.',
    ],
    [
      'p',
      'Two properties make the problem tractable. First, a line of text is a horizontal run of glyphs that share a baseline and sit close enough together to be read as one unit. Second, a column is a vertical band in which lines start at a consistent left edge and stop short of the band beside it. Both are measurable from the positions alone.',
    ],
    [
      'p',
      'The approach has a cost. It assumes the page was laid out with intent, so a deliberately scattered poster or a collage will defeat it. Those documents are rare in the settings that matter here: course readings, journal articles, government reports, and the exported slides that circulate in every organisation.',
    ],
  ],
  right: [
    ['h', '2  Method'],
    [
      'p',
      'We treat the page as a set of positioned runs and reconstruct structure in three passes: clustering into lines, segmentation into columns, and sequencing of the resulting blocks. Each pass exposes a confidence, and the lowest confidence in the chain governs the whole page.',
    ],
    [
      'p',
      'Tagging a document fixes it once, permanently, and for every consumer. Reconstruction fixes a reading session, and must be repeated. The advantage of reconstruction is reach, because it works on documents that nobody will ever remediate.',
    ],
    [
      'p',
      'The method is deliberately narrow. We handle born-digital pages with one or two columns, and we refuse scans rather than guess at words we cannot see.',
    ],
    [
      'p',
      'Sequencing uses the gutter to divide the page into bands. A line that crosses the gutter closes the band above it and opens the one below, which is how a full-width title, a figure caption, or a table rule keeps its place between the columns instead of being sorted into one of them.',
    ],
    [
      'p',
      'Every stage reports how much evidence it had. A gutter with a wide, empty shoulder produces high confidence; a page whose text crowds the middle produces low confidence, and the block is flagged rather than silently ordered. The reader sees the flag before they hear the text.',
    ],
  ],
};

const PAGE_TWO = {
  leftTop: [
    ['h', '3  Results'],
    [
      'p',
      'Across the corpus, column detection succeeded whenever the gutter remained clear for the full height of the text block. It failed most often on pages carrying a full-width figure, where the gutter is interrupted and the measure of emptiness collapses.',
    ],
    [
      'p',
      'Band detection recovered most of those pages. A figure that crosses the gutter splits the page in two, and each half is measured on its own, so the interrupted gutter stops being a problem and becomes a boundary instead.',
    ],
  ],
  rightTop: [
    ['h', '4  Discussion'],
    [
      'p',
      'Confidence reporting mattered more than accuracy in our trials. Participants tolerated an admitted uncertainty and distrusted a silent guess. A wrong order that presents itself as certain is worse than a flagged ambiguity, because the reader has no way to notice the error.',
    ],
    [
      'p',
      'The effect held across experience levels. Readers new to assistive technology were the most likely to abandon a document after one bad passage, which is the outcome a repair tool exists to prevent.',
    ],
  ],
  spanning:
    'Figure 1. A spanning caption interrupts the gutter. Text above it belongs to both columns; text below it resumes the same two-column flow. The band rule keeps the caption between them.',
  figure: true,
  leftBottom: [
    ['h', '5  Conclusion'],
    [
      'p',
      'Reading order is recoverable from geometry, cheaply, in the browser, without a licence and without an expert. That is enough to make a large class of documents usable that are currently not.',
    ],
    [
      'p',
      'The remaining failures were mostly pages with a narrow gutter and a wide figure. A second pass that measured whitespace per band recovered some of them, but we left it out of this version because it made single-column pages less stable.',
    ],
    [
      'p',
      'We also measured the cost of a wrong split. When a page was split into two columns that were not there, the order changed but the text remained readable, because each half was still internally ordered. The failure mode is confusing, not catastrophic.',
    ],
  ],
  rightBottom: [
    ['h', '6  Limitations'],
    [
      'p',
      'We do not handle scans, three-column layouts, or mathematics. Where the pipeline is unsure, it says so per block. A visible uncertainty is more useful than a confident wrong answer.',
    ],
    [
      'p',
      'The tool does not claim to replace a tagged PDF. It claims to make an untagged one usable now, and to show where it is unsure.',
    ],
    [
      'p',
      'That distinction matters for procurement. A library can deploy a browser tool without a licence negotiation, and a student can use it on a personal laptop without asking anyone for permission.',
    ],
  ],
};

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Lay out one column from a top baseline. Returns positioned lines. */
function buildColumn(items, x, startY) {
  const lines = [];
  let y = startY;
  for (const [kind, text] of items) {
    if (kind === 'h') {
      lines.push({ x, y, text, font: 'F2', size: 11, gray: 0 });
      y -= LEADING * 1.7;
    } else {
      for (const line of wrap(text, BODY_SIZE, COL_W)) {
        lines.push({ x, y, text: line, font: 'F1', size: BODY_SIZE, gray: 0 });
        y -= LEADING;
      }
      y -= LEADING * 0.45;
    }
  }
  return { lines, bottom: y };
}

function pageContent(spec, pageNumber) {
  const ops = [];

  // Running header: small print in the margin, repeated on both pages.
  ops.push('BT /F2 8 Tf 0.45 g');
  ops.push(`1 0 0 1 ${MARGIN} ${PAGE_H - 44} Tm (${esc(TITLE)}) Tj`);
  ops.push('ET');

  const front = [];
  let bodyTop = PAGE_H - MARGIN - 30;

  if (spec.title) {
    let y = bodyTop;
    for (const line of wrap(TITLE, 18, PAGE_W - MARGIN * 2)) {
      front.push({ x: MARGIN, y, text: line, font: 'F2', size: 18, gray: 0 });
      y -= 21;
    }
    y -= 4;
    for (const line of wrap(SUBTITLE, 11, PAGE_W - MARGIN * 2)) {
      front.push({ x: MARGIN, y, text: line, font: 'F1', size: 11, gray: 0.25 });
      y -= 14;
    }
    y -= 2;
    front.push({ x: MARGIN, y, text: AUTHOR, font: 'F1', size: 9.5, gray: 0.35 });
    bodyTop = y - 26;
  }

  const body = [];

  if (spec.spanning) {
    const left = buildColumn(spec.leftTop, LEFT_X, bodyTop);
    const right = buildColumn(spec.rightTop, RIGHT_X, bodyTop);
    body.push(...left.lines, ...right.lines);

    // A framed figure across the full measure. It is drawing, not text, so the
    // pipeline never sees it; it is here so the page looks like a paper and the
    // caption has something to sit under.
    const figureTop = Math.min(left.bottom, right.bottom) - 18;
    const figureH = 92;
    if (spec.figure) {
      const x0 = MARGIN;
      const x1 = PAGE_W - MARGIN;
      ops.push(`0.97 g ${x0} ${figureTop - figureH} ${x1 - x0} ${figureH} re f`);
      ops.push(
        `0.82 G 0.8 w ${x0} ${figureTop - figureH} ${x1 - x0} ${figureH} re S`,
      );
      // A few bars, so the frame reads as a chart rather than a blank box.
      const barBase = figureTop - figureH + 14;
      const barW = 22;
      for (let i = 0; i < 7; i++) {
        const h = 18 + ((i * 37) % 52);
        const bx = x0 + 26 + i * 44;
        ops.push(`0.80 g ${bx} ${barBase} ${barW} ${h} re f`);
      }
    }

    // The caption sits below the figure, across the full measure.
    const captionY = figureTop - figureH - 16;
    const captionLines = wrap(spec.spanning, 9.5, PAGE_W - MARGIN * 2);
    captionLines.forEach((line, i) => {
      body.push({
        x: MARGIN,
        y: captionY - i * 12,
        text: line,
        font: 'F1',
        size: 9.5,
        gray: 0.2,
      });
    });

    const below = captionY - captionLines.length * 12 - 16;
    const left2 = buildColumn(spec.leftBottom, LEFT_X, below);
    const right2 = buildColumn(spec.rightBottom, RIGHT_X, below);
    body.push(...left2.lines, ...right2.lines);
  } else {
    const left = buildColumn(spec.left, LEFT_X, bodyTop);
    const right = buildColumn(spec.right, RIGHT_X, bodyTop);
    body.push(...left.lines, ...right.lines);
  }

  // The title block is written first, as a producer would write it.
  for (const line of front) {
    ops.push(
      `BT /${line.font} ${line.size} Tf ${line.gray} g 1 0 0 1 ${line.x} ${line.y} Tm (${esc(line.text)}) Tj ET`,
    );
  }

  // Body text is written row by row, left then right. This is the defect the
  // app repairs: the stream crosses the gutter on almost every row.
  const rows = [];
  for (const line of body) {
    let row = rows.find((r) => Math.abs(r.y - line.y) <= 2.5);
    if (!row) {
      row = { y: line.y, lines: [] };
      rows.push(row);
    }
    row.lines.push(line);
  }
  // PDF coordinates grow upward, so descending y is top to bottom: the order a
  // producer would actually write a page in.
  rows.sort((a, b) => b.y - a.y);
  for (const row of rows) {
    row.lines.sort((a, b) => a.x - b.x);
    for (const line of row.lines) {
      ops.push(
        `BT /${line.font} ${line.size} Tf ${line.gray} g 1 0 0 1 ${line.x} ${line.y} Tm (${esc(line.text)}) Tj ET`,
      );
    }
  }

  // Page number: bare, small, in the footer.
  ops.push('BT /F1 8 Tf 0.45 g');
  ops.push(`1 0 0 1 ${PAGE_W / 2 - 3} 44 Tm (${pageNumber}) Tj`);
  ops.push('ET');

  return ops.join('\n');
}

const CONTENTS = [pageContent(PAGE_ONE, 1), pageContent(PAGE_TWO, 2)];

const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
    `/Resources << /Font << /F1 7 0 R /F2 8 0 R >> >> /Contents 4 0 R >>`,
  `<< /Length ${CONTENTS[0].length} >>\nstream\n${CONTENTS[0]}\nendstream`,
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
    `/Resources << /Font << /F1 7 0 R /F2 8 0 R >> >> /Contents 6 0 R >>`,
  `<< /Length ${CONTENTS[1].length} >>\nstream\n${CONTENTS[1]}\nendstream`,
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
