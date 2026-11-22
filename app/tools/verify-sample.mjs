import fs from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const data = new Uint8Array(fs.readFileSync('public/samples/two-column-paper.pdf'));
const task = pdfjs.getDocument({ data, useSystemFonts: false });
const doc = await task.promise;
console.log('pages', doc.numPages);

for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n);
  const content = await page.getTextContent();
  const items = content.items.filter((i) => 'str' in i && i.str.trim());
  const gutter = 306;
  const seq = items.slice(0, 14).map((i) => {
    const x = i.transform[4];
    return `${x < gutter ? 'L' : 'R'}:${i.str.slice(0, 18)}`;
  });
  console.log(`page ${n} stream:`, seq.join(' | '));

  // Count gutter crossings between consecutive body lines.
  let crossings = 0;
  for (let i = 1; i < items.length; i++) {
    const a = items[i - 1].transform[4] < gutter;
    const b = items[i].transform[4] < gutter;
    if (a !== b) crossings++;
  }
  console.log(`page ${n} stream crossings: ${crossings} of ${items.length - 1}`);
}

await task.destroy();
