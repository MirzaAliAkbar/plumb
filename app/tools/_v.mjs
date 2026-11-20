import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:1440,height:1000} })).newPage();
await p.goto('https://plumb-akw.pages.dev');
await p.waitForTimeout(800);
console.log('=== TITLE ===\n' + await p.title());
console.log('=== H1 ===\n' + await p.locator('h1').first().innerText());
console.log('=== HEADINGS ===');
for (const h of await p.locator('h1,h2,h3').all()) console.log(' ', await h.evaluate(e=>e.tagName+': '+e.innerText.trim().slice(0,80)));
console.log('=== BUTTONS/INPUTS ===');
for (const el of await p.locator('button, input, [role=button], a').all()) {
  const t = await el.evaluate(e=>({tag:e.tagName, role:e.getAttribute('role'), text:(e.innerText||'').trim().slice(0,60), label:e.getAttribute('aria-label'), type:e.type}));
  if (t.text || t.label) console.log(' ', JSON.stringify(t));
}
console.log('=== FOLD: is the dropzone above the fold? ===');
const dz = p.locator('input[type=file]').first();
const box = await dz.boundingBox();
console.log(' file input y =', box?.y, '(viewport 1000)');
console.log('=== SAMPLE ONE-CLICK? ===');
console.log(' body mentions "sample":', /sample/i.test(await p.locator('body').innerText()));
console.log('=== BODY TEXT (first 1200 chars) ===\n' + (await p.locator('body').innerText()).slice(0,1200));
await b.close();
