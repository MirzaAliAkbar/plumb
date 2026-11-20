/**
 * Dump the block structure of one PDF, so classification bugs are visible
 * instead of inferred. Not part of the shipped app; a debugging aid.
 *
 * Run: npx tsx tools/blocks.mts <file.pdf>
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import { clusterLines } from '../src/lib/lines.ts';
import { detectLayout, findRunningElements, runningKey } from '../src/lib/layout.ts';
import { sequenceBlocks } from '../src/lib/sequence.ts';
import { estimateBodySize } from '../src/lib/pipeline.ts';
import type { TextRun } from '../src/lib/types.ts';

const file = process.argv[2] ?? 'public/samples/two-column-paper.pdf';
const data = new Uint8Array(fs.readFileSync(file));
const doc = await pdfjs.getDocument({ data }).promise;

const pagesLines: any[][] = [];
const dims: { width: number; height: number }[] = [];
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
  pagesLines.push(clusterLines(runs));
  dims.push({ width: vp.width, height: vp.height });
}

const repeated = findRunningElements(pagesLines, dims[0].height);
const bodySize = estimateBodySize(pagesLines);

console.log('page height   ', dims[0].height);
console.log('body size     ', bodySize);
console.log('suppressed    ', [...repeated]);
console.log();

for (let i = 0; i < pagesLines.length; i++) {
  const lines = pagesLines[i];
  console.log(`--- page ${i + 1}: ${lines.length} lines ---`);
  for (const l of lines) {
    const inBand = l.y < dims[i].height * 0.085 || l.y > dims[i].height * 0.925;
    console.log(
      `  y=${l.y.toFixed(1).padStart(6)} x0=${l.x0.toFixed(0).padStart(4)} ` +
        `size=${l.size.toFixed(1)} font=${String(l.runs[0]?.font).slice(0, 12).padEnd(12)}` +
        `${inBand ? ' BAND' : '     '} ${l.text.slice(0, 44)}`,
    );
  }

  const kept = lines.filter((l) => !repeated.has(runningKey(l)));
  const layout = detectLayout(kept, dims[i].width);
  const blocks = sequenceBlocks(kept, layout, { bodySize });
  console.log(`  columns=${layout.columns} confidence=${layout.confidence.toFixed(2)}`);
  for (const b of blocks) {
    console.log(
      `    [${String(b.order).padStart(2)}] ${b.kind.padEnd(10)} ` +
        `conf=${b.confidence.toFixed(2)} lines=${b.lines.length} :: ${b.lines[0].text.slice(0, 52)}`,
    );
  }
  console.log();
}
