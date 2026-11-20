import fs from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { clusterLines } from '../src/lib/lines.ts';
import { detectLayout, findRunningElements, runningKey } from '../src/lib/layout.ts';
import { sequenceBlocks } from '../src/lib/sequence.ts';
import { estimateBodySize } from '../src/lib/pipeline.ts';
import { toSemanticHtml } from '../src/lib/export.ts';
import type { TextRun, DocumentAnalysis, Line, PageAnalysis } from '../src/lib/types.ts';

const file = process.argv[2] ?? 'public/samples/two-column-paper.pdf';
const data = new Uint8Array(fs.readFileSync(file));
const doc = await pdfjs.getDocument({ data }).promise;

const pagesLines: Line[][] = [];
const dims: { w: number; h: number }[] = [];

for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const vp = page.getViewport({ scale: 1 });
  dims.push({ w: vp.width, h: vp.height });
  const tc = await page.getTextContent();
  const runs: TextRun[] = [];
  for (const it of tc.items) {
    if (!('str' in it) || !it.str || !it.str.trim()) continue;
    const t = (it as unknown as { transform: number[] }).transform;
    const size = Math.abs(t[3]) || 10;
    runs.push({
      str: it.str,
      x: t[4],
      y: vp.height - t[5],
      w: (it as unknown as { width?: number }).width || 10,
      h: size,
      font: '',
      size,
    });
  }
  pagesLines.push(clusterLines(runs));
}

const repeated = findRunningElements(pagesLines, dims[0].h);
const bodySize = estimateBodySize(pagesLines);

const pages: PageAnalysis[] = pagesLines.map((lines, i) => {
  const kept = lines.filter((l) => !repeated.has(runningKey(l)));
  const layout = detectLayout(kept, dims[i].w);
  const blocks = sequenceBlocks(kept, layout, { bodySize });
  const conf = blocks.length ? blocks.reduce((a, b) => a + b.confidence, 0) / blocks.length : 0;
  return {
    pageIndex: i,
    width: dims[i].w,
    height: dims[i].h,
    columns: layout.columns,
    blocks,
    suppressed: lines.filter((l) => repeated.has(runningKey(l))),
    confidence: conf,
  };
});

const analysis: DocumentAnalysis = {
  fileName: file.split('/').pop() ?? 'document.pdf',
  pageCount: pages.length,
  pages,
  confidence: pages.reduce((a, p) => a + p.confidence, 0) / pages.length,
};

const html = toSemanticHtml(analysis, 'two-column-paper');
fs.writeFileSync('export-check.html', html);

console.log('--- exported HTML checks ---');
const checks: Array<[string, boolean]> = [
  ['doctype', html.startsWith('<!doctype html>')],
  ['lang attribute', /<html lang="en">/.test(html)],
  ['h1 present', /<h1>/.test(html)],
  ['h2 or h3 present', /<h[23]>/.test(html)],
  ['paragraphs present', /<p>/.test(html)],
  ['one section per page', (html.match(/<section aria-label="Page/g) || []).length === pages.length],
  ['all ampersands escaped', !/&(?!(amp|lt|gt|quot|#\d+);)/.test(html)],
  ['closes html', html.trim().endsWith('</html>')],
  ['no script injected', !/<script/i.test(html)],
];
let fails = 0;
for (const [name, ok] of checks) {
  console.log((ok ? '  ok   ' : '  FAIL ') + name);
  if (!ok) fails++;
}

console.log('\n--- heading structure ---');
for (const m of html.matchAll(/<(h[1-3])>(.*?)<\/\1>/g)) {
  console.log('  ' + m[1] + ': ' + m[2].slice(0, 64));
}

console.log('\n--- first 3 paragraphs ---');
for (const m of [...html.matchAll(/<p>(.*?)<\/p>/g)].slice(0, 3)) {
  console.log('  ' + m[1].slice(0, 90));
}

console.log('\n--- suppressed as running header/footer ---');
console.log('  ' + pages[0].suppressed.map((l) => l.text).join(' | '));

await doc.cleanup();
process.exit(fails === 0 ? 0 : 1);
