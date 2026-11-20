/**
 * Accuracy harness.
 *
 * Runs the real pipeline over a corpus of real PDFs and reports, honestly, where
 * it works and where it does not. This exists so that the claims on the
 * submission page are measured rather than asserted.
 *
 * Run: node harness/accuracy.mjs [--json]
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import path from 'node:path';

const { clusterLines, joinLines } = await import('../dist-lib/lines.js');
const { detectLayout, findRunningElements, signature } = await import('../dist-lib/layout.js');
const { sequenceBlocks } = await import('../dist-lib/sequence.js');
const { estimateBodySize } = await import('../dist-lib/pipeline.js');

const dir = 'pdfs';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.pdf'));
const rows = [];

for (const file of files) {
  const data = new Uint8Array(fs.readFileSync(path.join(dir, file)));
  const doc = await pdfjs.getDocument({ data }).promise;

  const pagesLines = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const runs = [];
    for (const item of tc.items) {
      if (!('str' in item) || !item.str || !item.str.trim()) continue;
      const [, , , d, e, f] = item.transform;
      const size = Math.abs(d) || 10;
      runs.push({
        str: item.str,
        x: e,
        y: vp.height - f,
        w: item.width || item.str.length * size * 0.5,
        h: Math.abs(item.height) || size,
        font: item.fontName || '',
        size,
      });
    }
    pagesLines.push({ lines: clusterLines(runs), width: vp.width, height: vp.height, runs });
  }

  const repeated = findRunningElements(
    pagesLines.map((p) => p.lines),
    pagesLines[0].height,
  );
  const bodySize = estimateBodySize(pagesLines.map((p) => p.lines));

  let twoColPages = 0;
  let totalBlocks = 0;
  let lowConfBlocks = 0;
  let suppressed = 0;
  let confidenceSum = 0;

  for (const p of pagesLines) {
    const kept = p.lines.filter((l) => !repeated.has(signature(l.text)));
    suppressed += p.lines.length - kept.length;
    const layout = detectLayout(kept, p.width);
    if (layout.columns === 2) twoColPages++;
    const blocks = sequenceBlocks(kept, layout, { bodySize });
    totalBlocks += blocks.length;
    lowConfBlocks += blocks.filter((b) => b.confidence < 0.6).length;
    confidenceSum += blocks.reduce((a, b) => a + b.confidence, 0) / Math.max(1, blocks.length);
  }

  const printable = pagesLines.every((p) =>
    p.lines.every((l) => !/[\uFFFD\u0000]/.test(l.text)),
  );

  rows.push({
    file,
    pages: doc.numPages,
    twoColPages,
    totalBlocks,
    lowConfPct: totalBlocks ? (lowConfBlocks / totalBlocks) * 100 : 0,
    suppressed,
    confidence: (confidenceSum / doc.numPages) * 100,
    cleanText: printable,
  });
  await doc.destroy();
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log(
    '\nfile'.padEnd(22) +
      'pages'.padStart(6) +
      '2col'.padStart(6) +
      'blocks'.padStart(8) +
      'lowconf'.padStart(9) +
      'suppr'.padStart(7) +
      'conf'.padStart(8) +
      '  text',
  );
  console.log('-'.repeat(78));
  for (const r of rows) {
    console.log(
      r.file.padEnd(22) +
        String(r.pages).padStart(6) +
        String(r.twoColPages).padStart(6) +
        String(r.totalBlocks).padStart(8) +
        (r.lowConfPct.toFixed(0) + '%').padStart(9) +
        String(r.suppressed).padStart(7) +
        (r.confidence.toFixed(0) + '%').padStart(8) +
        (r.cleanText ? '  clean' : '  GARBLED'),
    );
  }
  const meanConf = rows.reduce((a, r) => a + r.confidence, 0) / rows.length;
  const meanLow = rows.reduce((a, r) => a + r.lowConfPct, 0) / rows.length;
  console.log('-'.repeat(78));
  console.log(`mean confidence ${meanConf.toFixed(1)}%   mean low-confidence blocks ${meanLow.toFixed(1)}%`);
  console.log(`clean text extraction on ${rows.filter((r) => r.cleanText).length}/${rows.length} documents`);
}
