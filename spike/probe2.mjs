// SPIKE 2: on a genuine two-column body page, is content-stream order scrambled,
// and can a proper geometric heuristic recover the correct order?
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';

const file = 'pdfs/1706.03762.pdf';
const data = new Uint8Array(fs.readFileSync(file));
const doc = await pdfjs.getDocument({ data }).promise;

const page = await doc.getPage(4);           // body page: definitely two-column
const vp = page.getViewport({ scale: 1 });
const tc = await page.getTextContent();
const items = tc.items.filter(i => typeof i.str === 'string' && i.str.trim());

const W = vp.width;
console.log(`page 4: ${W.toFixed(0)}pt wide, ${items.length} text runs\n`);

// --- 1. what does the RAW content-stream order look like? (what a screen reader gets)
console.log('RAW content-stream order (first 25 lines, what NVDA would read):');
const linesRaw = [];
for (const it of items) {
  const x = it.transform[4], y = it.transform[5];
  const last = linesRaw[linesRaw.length - 1];
  if (last && Math.abs(last.y - y) < 4) { last.parts.push({ x, s: it.str }); }
  else linesRaw.push({ y, parts: [{ x, s: it.str }] });
}
for (const L of linesRaw.slice(0, 25)) {
  const text = L.parts.sort((a, b) => a.x - b.x).map(p => p.s).join(' ').replace(/\s+/g, ' ');
  console.log(`  y=${L.y.toFixed(0).padStart(4)}  x=${L.parts[0].x.toFixed(0).padStart(3)}  ${text.slice(0, 72)}`);
}

// --- 2. proper column detection: 1D k-means-ish split on the x of line-starts
const starts = linesRaw.map(L => L.parts.sort((a,b)=>a.x-b.x)[0].x);
const minX = Math.min(...starts), maxX = Math.max(...starts);
const mid = (minX + maxX) / 2;
const left = linesRaw.filter(L => L.parts.sort((a,b)=>a.x-b.x)[0].x < mid);
const right = linesRaw.filter(L => L.parts.sort((a,b)=>a.x-b.x)[0].x >= mid);
console.log(`\ncolumn split at x=${mid.toFixed(0)}: left=${left.length} lines, right=${right.length} lines`);

// --- 3. reconstructed order
const order = [...left.sort((a,b)=>b.y-a.y), ...right.sort((a,b)=>b.y-a.y)];
console.log('\nRECONSTRUCTED order (first 25 lines, what ORDER would produce):');
for (const L of order.slice(0, 25)) {
  const text = L.parts.sort((a, b) => a.x - b.x).map(p => p.s).join(' ').replace(/\s+/g, ' ');
  console.log(`  y=${L.y.toFixed(0).padStart(4)}  x=${L.parts[0].x.toFixed(0).padStart(3)}  ${text.slice(0, 72)}`);
}

// --- 4. does the reconstruction actually change anything?
const norm = a => a.map(L => L.parts.sort((p,q)=>p.x-q.x).map(p=>p.s).join('')).join('|');
console.log(`\nidentical to raw order? ${norm(linesRaw) === norm(order)}`);
