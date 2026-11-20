/**
 * Show every line on the pages where real section headings live, with size and
 * font, so the heading rule can be checked against ground truth.
 *
 * Run: npx tsx tools/linelist.mts <file.pdf> <pageNumber>
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import { clusterLines } from '../src/lib/lines.ts';
import type { TextRun } from '../src/lib/types.ts';

const file = process.argv[2];
const wantPage = Number(process.argv[3] ?? 1);
const data = new Uint8Array(fs.readFileSync(file));
const doc = await pdfjs.getDocument({ data }).promise;

const page = await doc.getPage(wantPage);
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

for (const l of clusterLines(runs)) {
  console.log(
    `y=${l.y.toFixed(1).padStart(6)} x0=${l.x0.toFixed(0).padStart(4)} ` +
      `size=${l.size.toFixed(1).padStart(5)} font=${String(l.runs[0]?.font).padEnd(12)} ${l.text.slice(0, 62)}`,
  );
}
