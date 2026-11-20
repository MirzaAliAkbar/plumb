/**
 * Fetch the accuracy corpus.
 *
 * The papers are deliberately NOT vendored: they are other people's work, and a
 * public repo has no business redistributing them. This script rebuilds the exact
 * corpus the numbers in EVIDENCE.md were measured on, so the claim stays
 * reproducible without shipping someone else's PDFs.
 *
 * Run: node tools/fetch-corpus.mjs [target-dir]
 */
import fs from 'node:fs';
import path from 'node:path';

const target = process.argv[2] ?? '../spike/pdfs';

const PAPERS = [
  ['1512.03385.pdf', 'https://arxiv.org/pdf/1512.03385'], // ResNet — dense two-column
  ['1706.03762.pdf', 'https://arxiv.org/pdf/1706.03762'], // Attention Is All You Need
  ['1810.04805.pdf', 'https://arxiv.org/pdf/1810.04805'], // BERT
  ['2103.00020.pdf', 'https://arxiv.org/pdf/2103.00020'], // CLIP — long, 48 pages
  ['2106.09685.pdf', 'https://arxiv.org/pdf/2106.09685'], // LoRA
  ['2305.18290.pdf', 'https://arxiv.org/pdf/2305.18290'], // DPO — single column
];

fs.mkdirSync(target, { recursive: true });

for (const [name, url] of PAPERS) {
  const dest = path.join(target, name);
  if (fs.existsSync(dest)) {
    console.log(`have  ${name}`);
    continue;
  }
  process.stdout.write(`fetch ${name} … `);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    console.log(`FAILED (${res.status})`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  console.log(`${(buf.length / 1024 / 1024).toFixed(1)} MB`);
}

console.log(`\nCorpus ready in ${path.resolve(target)}`);
console.log('Now run: npx tsx tools/accuracy.mts ' + target);
