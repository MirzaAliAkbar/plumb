// SPIKE 3: genuine two-column papers. Measure how scrambled raw order is,
// and whether a proper heuristic recovers it.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';

const FILES = process.argv.slice(2);

function clusterLines(items) {
  const sorted = [...items].sort((a, b) => b.transform[5] - a.transform[5]);
  const lines = [];
  for (const it of sorted) {
    const y = it.transform[5];
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - y) < 3.5) last.parts.push(it);
    else lines.push({ y, parts: [it] });
  }
  return lines.map(L => {
    const parts = L.parts.sort((a, b) => a.transform[4] - b.transform[4]);
    return { y: L.y, x0: parts[0].transform[4], x1: parts[parts.length - 1].transform[4] + parts[parts.length - 1].width, parts };
  });
}

for (const file of FILES) {
  const data = new Uint8Array(fs.readFileSync('pdfs/' + file));
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(Math.min(3, doc.numPages));
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const items = tc.items.filter(i => typeof i.str === 'string' && i.str.trim());
  const lines = clusterLines(items);
  const W = vp.width;

  // gutter detection: histogram of line START x, find widest zero-run in middle 30-70%
  const NB = 50;
  const hist = new Array(NB).fill(0);
  for (const L of lines) hist[Math.min(NB - 1, Math.floor(L.x0 / W * NB))]++;
  let best = 0, run = 0, bestAt = 0, runAt = 0;
  for (let i = Math.floor(NB * 0.25); i < Math.floor(NB * 0.75); i++) {
    if (hist[i] === 0) { if (!run) runAt = i; run++; if (run > best) { best = run; bestAt = runAt; } }
    else run = 0;
  }
  const gutter = best > 0 ? (bestAt + best / 2) / NB * W : W / 2;

  // RAW order vs CONTENT-STREAM order comparison
  // raw = the order pdf.js returns items in (content stream)
  const rawLines = clusterLines(items); // this sorts by y; real raw needs content order
  const streamOrder = items.map(i => ({ y: i.transform[5], x: i.transform[4], s: i.str }));

  // measure: in content-stream order, how often does x jump backwards a lot while y moves little?
  let backwards = 0, total = 0;
  for (let i = 1; i < streamOrder.length; i++) {
    const a = streamOrder[i - 1], b = streamOrder[i];
    if (Math.abs(a.y - b.y) > 2 && Math.abs(a.y - b.y) < 20) {
      total++;
      if (b.x < a.x - W * 0.2) backwards++;
    }
  }

  const left = lines.filter(L => L.x0 < gutter);
  const right = lines.filter(L => L.x0 >= gutter);
  const isTwoCol = left.length >= 4 && right.length >= 4;

  console.log(`\n${file}  page ${Math.min(3, doc.numPages)}  ${W.toFixed(0)}pt  lines=${lines.length}`);
  console.log(`  gutter x=${gutter.toFixed(0)} (${(gutter/W*100).toFixed(0)}%)  left=${left.length} right=${right.length}  => ${isTwoCol ? 'TWO-COLUMN' : 'single/noisy'}`);
  console.log(`  content-stream backwards-x jumps in-line: ${backwards}/${total} (${total ? (backwards/total*100).toFixed(0) : 0}%)`);
  if (isTwoCol) {
    console.log(`  --> RAW order would read:  L[${left.map(l=>l.y.toFixed(0)).slice(0,4).join(',')}...] interleaved with R[...]`);
    console.log(`  --> FIXED order:  left col top-down (y ${Math.max(...left.map(l=>l.y)).toFixed(0)}..${Math.min(...left.map(l=>l.y)).toFixed(0)}), then right col`);
    console.log(`  first left line : ${left.sort((a,b)=>b.y-a.y)[0].parts.map(p=>p.str).join(' ').slice(0,70)}`);
    console.log(`  first right line: ${right.sort((a,b)=>b.y-a.y)[0].parts.map(p=>p.str).join(' ').slice(0,70)}`);
  }
}
