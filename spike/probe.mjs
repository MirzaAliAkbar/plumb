// SPIKE: does pdf.js give usable geometry, and is content-stream order actually wrong?
// Answers the red team's two load-bearing claims with numbers instead of assertions.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';

const files = fs.readdirSync('./pdfs').filter(f => f.endsWith('.pdf'));

for (const file of files) {
  const data = new Uint8Array(fs.readFileSync('./pdfs/' + file));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: false }).promise;
  console.log(`\n${'='.repeat(70)}\n${file}  pages=${doc.numPages}`);

  // page 1 is usually title/abstract (single column); page 2+ is body (two column)
  for (const pageNum of [1, 2]) {
    if (pageNum > doc.numPages) continue;
    const page = await doc.getPage(pageNum);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();

    const items = tc.items.filter(i => typeof i.str === 'string');
    const nonEmpty = items.filter(i => i.str.trim().length > 0);
    const garbage = items.filter(i => /[\uFFFD\u0000]/.test(i.str));
    const empty = items.filter(i => i.str.length > 0 && i.str.trim().length === 0);
    const chars = nonEmpty.reduce((a, i) => a + i.str.length, 0);

    // x-histogram to find the gutter
    const xs = nonEmpty.map(i => i.transform[4]).sort((a, b) => a - b);
    const w = vp.width;
    const BINS = 40;
    const hist = new Array(BINS).fill(0);
    for (const x of xs) hist[Math.min(BINS - 1, Math.floor((x / w) * BINS))]++;

    // find widest contiguous run of empty bins in the middle 20-80% of the page
    let bestGap = 0, gapStart = 0, run = 0, runStart = 0;
    for (let i = Math.floor(BINS * 0.2); i < Math.floor(BINS * 0.8); i++) {
      if (hist[i] === 0) { if (run === 0) runStart = i; run++; if (run > bestGap) { bestGap = run; gapStart = runStart; } }
      else run = 0;
    }
    const gutterPct = ((gapStart + bestGap / 2) / BINS * 100).toFixed(1);

    // is content-stream order actually scrambled? count how often consecutive items
    // jump backwards in x after a big y move (signature of column interleaving)
    let jumps = 0, backJumps = 0;
    for (let i = 1; i < nonEmpty.length; i++) {
      const a = nonEmpty[i - 1], b = nonEmpty[i];
      const dy = Math.abs(a.transform[5] - b.transform[5]);
      const dx = b.transform[4] - a.transform[4];
      if (dy > 4) { jumps++; if (dx < -w * 0.25) backJumps++; }
    }

    console.log(`\n  page ${pageNum}  (${w.toFixed(0)}x${vp.height.toFixed(0)}pt)`);
    console.log(`    text items          : ${items.length} (non-empty ${nonEmpty.length})`);
    console.log(`    total chars         : ${chars}`);
    console.log(`    garbage chars U+FFFD: ${garbage.length}`);
    console.log(`    whitespace-only     : ${empty.length}`);
    console.log(`    empty str (missing) : ${items.filter(i => i.str === '').length}`);
    console.log(`    widest mid-page x gap: ${bestGap} bins (~${(bestGap / BINS * 100).toFixed(0)}% of width) at x=${gutterPct}%`);
    console.log(`    line-jumps w/ big back-x: ${backJumps}/${jumps}  <- high => content-stream order is scrambled`);
    console.log(`    has transform matrix: ${nonEmpty[0]?.transform ? 'yes' : 'no'}, sample str: ${JSON.stringify(nonEmpty[3]?.str?.slice(0, 40))}`);
  }
}
