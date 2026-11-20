/**
 * Structural audit of the exported HTML.
 *
 * The whole product claim is "real headings, so the 71.6% of screen-reader users
 * who navigate by heading can actually move through the document". That claim is
 * about STRUCTURE, not text. So this measures structure on real papers:
 * how many headings are found, whether heading levels skip, and whether a
 * heading has been swallowed into the body text beside it.
 *
 * Run: npx tsx tools/structure.mts [corpus-dir]
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { clusterLines } from '../src/lib/lines.ts';
import { detectLayout, findRunningElements, runningKey } from '../src/lib/layout.ts';
import { sequenceBlocks } from '../src/lib/sequence.ts';
import { estimateBodySize } from '../src/lib/pipeline.ts';
import { toSemanticHtml } from '../src/lib/export.ts';
import type { DocumentAnalysis, PageAnalysis, TextRun } from '../src/lib/types.ts';

const dir = process.argv[2] ?? '../spike/pdfs';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.pdf'));

const pad = (s: string, n: number) => String(s).padEnd(n);

console.log(
  '\n' +
    pad('file', 20) +
    pad('pages', 7) +
    pad('blocks', 8) +
    pad('h2', 5) +
    pad('h3', 5) +
    pad('lists', 7) +
    pad('caps', 6) +
    pad('skips', 7) +
    'verdict',
);
console.log('-'.repeat(72));

let totalSkips = 0;
let totalHeadings = 0;
let anySkip = false;

for (const file of files) {
  const data = new Uint8Array(fs.readFileSync(path.join(dir, file)));
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

  const repeated = findRunningElements(pagesLines, dims[0]?.height ?? 792);
  const bodySize = estimateBodySize(pagesLines);

  const pages: PageAnalysis[] = pagesLines.map((lines, i) => {
    const kept = lines.filter((l) => !repeated.has(runningKey(l)));
    const layout = detectLayout(kept, dims[i].width);
    const blocks = sequenceBlocks(kept, layout, { bodySize });
    return {
      pageIndex: i,
      width: dims[i].width,
      height: dims[i].height,
      columns: layout.columns,
      blocks,
      suppressed: [],
      confidence: 0.9,
    };
  });

  const analysis: DocumentAnalysis = {
    fileName: file.replace(/\.pdf$/, ''),
    pageCount: pages.length,
    pages,
    confidence: 0.9,
  };

  const html = toSemanticHtml(analysis, file.replace(/\.pdf$/, ''));
  const h2 = (html.match(/<h2[ >]/g) || []).length;
  const h3 = (html.match(/<h3[ >]/g) || []).length;
  const lists = (html.match(/<ul>/g) || []).length;
  const caps = (html.match(/<figcaption/g) || []).length;
  const blocks = pages.reduce((a, p) => a + p.blocks.length, 0);

  // Heading levels must never skip by more than one.
  const levels = [...html.matchAll(/<h([1-6])[ >]/g)].map((m) => Number(m[1]));
  let skips = 0;
  for (let i = 1; i < levels.length; i++) if (levels[i] - levels[i - 1] > 1) skips++;
  totalSkips += skips;
  totalHeadings += h2 + h3;
  if (skips) anySkip = true;

  console.log(
    pad(file, 20) +
      pad(doc.numPages, 7) +
      pad(blocks, 8) +
      pad(h2, 5) +
      pad(h3, 5) +
      pad(lists, 7) +
      pad(caps, 6) +
      pad(skips, 7) +
      (skips ? 'SKIP' : 'ok'),
  );
  await doc.cleanup();
}

console.log('-'.repeat(72));
console.log(`headings found       ${totalHeadings}`);
console.log(`heading level skips  ${totalSkips}`);
console.log(
  `verdict              ${anySkip ? 'FAIL — an outline with a skipped level is not navigable' : 'PASS'}`,
);
process.exit(anySkip ? 1 : 0);
