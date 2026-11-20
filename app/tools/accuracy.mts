/**
 * Accuracy harness.
 *
 * Runs the real pipeline over a corpus of real PDFs and reports where it works
 * and where it fails. This exists so the claims on the submission page are
 * measured, not asserted.
 *
 * Run: npx tsx tools/accuracy.mts [corpus-dir]
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { clusterLines } from '../src/lib/lines.ts';
import { detectLayout, findRunningElements, runningKey } from '../src/lib/layout.ts';
import { sequenceBlocks, orderLines } from '../src/lib/sequence.ts';
import { estimateBodySize } from '../src/lib/pipeline.ts';
import type { TextRun } from '../src/lib/types.ts';

const dir = process.argv[2] ?? '../spike/pdfs';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.pdf'));

interface Row {
  file: string;
  pages: number;
  twoColPages: number;
  blocks: number;
  lowConfPct: number;
  suppressed: number;
  confidence: number;
  clean: boolean;
  scrambleRate: number;
}

const rows: Row[] = [];

for (const file of files) {
  const data = new Uint8Array(fs.readFileSync(path.join(dir, file)));
  const doc = await pdfjs.getDocument({ data }).promise;

  const pages: { lines: any[]; width: number; height: number }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const runs: TextRun[] = [];
    for (const item of tc.items) {
      if (!('str' in item) || !item.str || !item.str.trim()) continue;
      const [, , , d, e, f] = item.transform as number[];
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
    pages.push({ lines: clusterLines(runs), width: vp.width, height: vp.height });
  }

  const repeated = findRunningElements(
    pages.map((p) => p.lines),
    pages[0]?.height ?? 792,
  );
  const bodySize = estimateBodySize(pages.map((p) => p.lines));

  let twoColPages = 0;
  let blocks = 0;
  let low = 0;
  let suppressed = 0;
  let confSum = 0;
  let scrambled = 0;
  let comparable = 0;

  for (const p of pages) {
    const kept = p.lines.filter((l) => !repeated.has(runningKey(l)));
    suppressed += p.lines.length - kept.length;
    const layout = detectLayout(kept, p.width);
    if (layout.columns === 2) twoColPages++;

    // How often does the raw content order jump backwards horizontally? That is
    // the signature of interleaved columns. Then measure how often our sequence
    // does the same, on the same page.
    const raw = [...p.lines]; // clusterLines already y-sorted
    let rawBack = 0;
    for (let i = 1; i < raw.length; i++) {
      if (raw[i].x0 < raw[i - 1].x0 - p.width * 0.2 && Math.abs(raw[i].y - raw[i - 1].y) < 40) rawBack++;
    }
    const fixed = orderLines(kept, layout);
    let fixedBack = 0;
    for (let i = 1; i < fixed.length; i++) {
      if (fixed[i].x0 < fixed[i - 1].x0 - p.width * 0.2 && Math.abs(fixed[i].y - fixed[i - 1].y) < 40) fixedBack++;
    }
    scrambled += rawBack;
    comparable += fixedBack;

    const bs = sequenceBlocks(kept, layout, { bodySize });
    blocks += bs.length;
    low += bs.filter((b) => b.confidence < 0.6).length;
    if (bs.length) confSum += bs.reduce((a, b) => a + b.confidence, 0) / bs.length;
  }

  rows.push({
    file,
    pages: doc.numPages,
    twoColPages,
    blocks,
    lowConfPct: blocks ? (low / blocks) * 100 : 0,
    suppressed,
    confidence: pages.length ? (confSum / pages.length) * 100 : 0,
    clean: pages.every((p) => p.lines.every((l: any) => !/[\uFFFD\u0000]/.test(l.text))), // eslint-disable-line no-control-regex
    scrambleRate: blocks ? (scrambled / Math.max(1, scrambled + comparable)) * 100 : 0,
  });
  await doc.cleanup();
}

const pad = (s: string, n: number) => s.padEnd(n);
console.log(
  '\n' + pad('file', 22) + pad('pages', 7) + pad('2col', 6) + pad('blocks', 8) +
    pad('lowconf', 9) + pad('suppr', 7) + pad('conf', 7) + 'text',
);
console.log('-'.repeat(72));
for (const r of rows) {
  console.log(
    pad(r.file, 22) + pad(String(r.pages), 7) + pad(String(r.twoColPages), 6) +
      pad(String(r.blocks), 8) + pad(r.lowConfPct.toFixed(0) + '%', 9) +
      pad(String(r.suppressed), 7) + pad(r.confidence.toFixed(0) + '%', 7) +
      (r.clean ? 'clean' : 'GARBLED'),
  );
}
console.log('-'.repeat(72));
const mean = (f: (r: Row) => number) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
console.log(`mean page confidence            ${mean((r) => r.confidence).toFixed(1)}%`);
console.log(`mean low-confidence blocks      ${mean((r) => r.lowConfPct).toFixed(1)}%`);
console.log(`clean text extraction           ${rows.filter((r) => r.clean).length}/${rows.length} documents`);
console.log(`backward x-jumps (raw vs fixed) ${rows.reduce((a, r) => a + r.scrambleRate, 0) / rows.length | 0}% typical`);
