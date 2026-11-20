/**
 * List the headings a PDF's export would produce, in order. Used to check that
 * heading detection is finding real sections rather than table rows, and not
 * missing real sections either.
 *
 * Run: npx tsx tools/headings.mts <file.pdf>
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import { clusterLines } from '../src/lib/lines.ts';
import { detectLayout, findRunningElements, runningKey } from '../src/lib/layout.ts';
import { sequenceBlocks } from '../src/lib/sequence.ts';
import { estimateBodySize } from '../src/lib/pipeline.ts';
import type { TextRun } from '../src/lib/types.ts';

const file = process.argv[2];
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
console.log('body size:', bodySize, '| pages:', doc.numPages);

for (let i = 0; i < pagesLines.length; i++) {
  const kept = pagesLines[i].filter((l) => !repeated.has(runningKey(l)));
  const layout = detectLayout(kept, dims[i].width);
  const blocks = sequenceBlocks(kept, layout, { bodySize });
  for (const b of blocks) {
    if (b.kind !== 'heading') continue;
    console.log(
      `  p${String(i + 1).padStart(2)} size=${b.lines[0].size.toFixed(1).padStart(5)} ` +
        `font=${String(b.lines[0].runs[0]?.font).slice(0, 10).padEnd(10)} ${b.lines[0].text.slice(0, 60)}`,
    );
  }
}
