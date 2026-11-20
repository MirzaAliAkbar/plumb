import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://plumb-akw.pages.dev';
const FILES = [
  '../spike/pdfs/1706.03762.pdf',
  '../spike/pdfs/2103.00020.pdf',
];

const b = await chromium.launch();

for (const rel of FILES) {
  const file = path.resolve(rel);
  if (!fs.existsSync(file)) {
    console.log('missing ' + rel);
    continue;
  }
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));

  const t0 = Date.now();
  await p.goto(BASE);
  await p.locator('input[type=file]').setInputFiles(file);
  await p.getByRole('tab', { name: 'Reading order' }).waitFor({ timeout: 120_000 });
  const ms = Date.now() - t0;

  const stats = await p.locator('.result__stats').innerText();
  const conf = await p.locator('.badge, [class*=confidence]').first().innerText().catch(() => '?');

  const [dl] = await Promise.all([
    p.waitForEvent('download'),
    p.getByRole('button', { name: /Download accessible HTML/i }).click(),
  ]);
  const dest = '/tmp/' + path.basename(file, '.pdf') + '.html';
  await dl.saveAs(dest);
  const html = fs.readFileSync(dest, 'utf8');

  const levels = [...html.matchAll(/<h([1-6])[ >]/g)].map((m) => Number(m[1]));
  let skips = 0;
  for (let i = 1; i < levels.length; i++) if (levels[i] - levels[i - 1] > 1) skips++;
  const h2 = (html.match(/<h2[ >]/g) || []).length;
  const h3 = (html.match(/<h3[ >]/g) || []).length;
  const figs = (html.match(/<figcaption/g) || []).length;

  console.log('\n=== ' + path.basename(file) + ' ===');
  console.log(' analysed in      ', ms + 'ms');
  console.log(' stats line       ', stats.replace(/\s+/g, ' '));
  console.log(' confidence       ', conf.replace(/\s+/g, ' '));
  console.log(' export bytes     ', html.length);
  console.log(' h2 / h3          ', h2 + ' / ' + h3);
  console.log(' figcaptions      ', figs);
  console.log(' heading skips    ', skips);
  console.log(' page errors      ', errors.length ? errors.slice(0, 3) : 'none');
  await ctx.close();
}
await b.close();
