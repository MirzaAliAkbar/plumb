/**
 * Measured design audit.
 *
 * Eyeballing screenshots is unreliable, so this asserts the design rules against
 * real computed values in a real browser: type scale, line measure, target
 * sizes, overflow, and the contrast of every rendered text node against its
 * effective background.
 *
 * The in-page code is passed as a string on purpose: the bundler that runs this
 * file injects `keepNames` helpers into function literals, which would leak
 * undefined identifiers into the browser context.
 */
import { chromium } from 'playwright';
import path from 'node:path';

const SAMPLE = path.resolve('public/samples/two-column-paper.pdf');
const URL = process.argv[2] ?? 'http://127.0.0.1:4173/';

const IN_PAGE = `(() => {
  function parseRgb(c) {
    var m = c.match(/[0-9.]+/g) || ['0','0','0'];
    return [Number(m[0]), Number(m[1]), Number(m[2])];
  }
  function toLum(rgb) {
    function f(x) { x = x / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  }
  function effBg(el) {
    var n = el;
    while (n && n !== document.documentElement) {
      var bg = getComputedStyle(n).backgroundColor;
      if (bg && !/rgba\\(0, 0, 0, 0\\)/.test(bg) && bg !== 'transparent') return bg;
      n = n.parentElement;
    }
    return 'rgb(251, 250, 247)';
  }

  var result = {};
  result.overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;

  var sizes = {};
  document.querySelectorAll('h1,h2,h3,p,li,span,button,a,figcaption,code').forEach(function (el) {
    if (!(el.textContent || '').trim()) return;
    var s = parseFloat(getComputedStyle(el).fontSize);
    sizes[s] = (sizes[s] || 0) + 1;
  });
  result.sizes = Object.keys(sizes).map(Number).sort(function (a, b) { return a - b; });

  var measures = [];
  document.querySelectorAll('p').forEach(function (el) {
    var t = (el.textContent || '').trim();
    if (t.length < 120) return;
    var cs = getComputedStyle(el);
    var w = el.getBoundingClientRect().width;
    var cv = document.createElement('canvas').getContext('2d');
    cv.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    var avg = cv.measureText('abcdefghijklmnopqrstuvwxyz ').width / 27;
    if (avg > 0) measures.push({ ch: Math.round(w / avg), cls: String(el.className || 'p'), w: Math.round(w) });
  });
  result.measures = measures;

  var small = [];
  document.querySelectorAll('button,a[href],[role=button],input').forEach(function (el) {
    var r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    if (getComputedStyle(el).position === 'absolute' && r.width <= 1) return;
    if (r.height < 24 || r.width < 24) {
      small.push(String(el.tagName) + '.' + String(el.className).slice(0, 28) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    }
  });
  result.small = small;

  var contrast = [];
  document.querySelectorAll('p,span,a,li,h1,h2,h3,button,figcaption,label,div').forEach(function (el) {
    if (!el.childNodes.length) return;
    var hasText = false;
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3 && n.textContent.trim()) { hasText = true; break; }
    }
    if (!hasText) return;
    var cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.1) return;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    var l1 = toLum(parseRgb(cs.color));
    var l2 = toLum(parseRgb(effBg(el)));
    var ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    var size = parseFloat(cs.fontSize);
    var weight = parseInt(cs.fontWeight, 10) || 400;
    var need = (size >= 24 || (size >= 18.66 && weight >= 700)) ? 3 : 4.5;
    if (ratio < need) {
      contrast.push(String(el.className || el.tagName).slice(0, 26) + ' ' + ratio.toFixed(2) + '<' + need + ' "' + (el.textContent || '').trim().slice(0, 24) + '"');
    }
  });
  result.contrast = contrast;

  var b = document.querySelector('button');
  if (b) {
    b.focus();
    var cs2 = getComputedStyle(b);
    result.focus = cs2.outlineStyle !== 'none' || cs2.boxShadow !== 'none';
  } else {
    result.focus = null;
  }

  var tiny = {};
  document.querySelectorAll('p,li,span,a').forEach(function (el) {
    var s = parseFloat(getComputedStyle(el).fontSize);
    if (s < 12 && (el.textContent || '').trim()) tiny[s] = true;
  });
  result.tiny = Object.keys(tiny).map(Number);

  return result;
})()`;

const browser = await chromium.launch();
let failures = 0;
const fail = (m) => {
  failures++;
  console.log('  FAIL ' + m);
};
const pass = (m) => console.log('  ok   ' + m);

async function audit(page, label) {
  console.log(`\n=== ${label} ===`);
  const r = await page.evaluate(IN_PAGE);

  if (r.overflow > 2) fail(`horizontal overflow ${r.overflow}px`);
  else pass('no horizontal overflow');

  console.log('  font sizes: ' + r.sizes.map((s) => s + 'px').join(' '));
  if (r.sizes.length > 12) fail(`${r.sizes.length} font sizes — scale incoherent`);
  else pass(`${r.sizes.length} font sizes — coherent scale`);

  if (r.measures.length) {
    const bad = r.measures.filter((m) => m.ch < 40 || m.ch > 92);
    if (bad.length) fail(`measure out of range: ${bad.map((m) => `${m.cls} ${m.ch}ch (${m.w}px)`).join(' | ')}`);
    else
      pass(
        `measure ${Math.min(...r.measures.map((m) => m.ch))}–${Math.max(...r.measures.map((m) => m.ch))}ch`,
      );
  }

  if (r.small.length) fail(`targets < 24px: ${r.small.join(' | ')}`);
  else pass('all targets >= 24px');

  if (r.contrast.length) fail(`contrast: ${r.contrast.slice(0, 5).join(' | ')}`);
  else pass('all text meets AA contrast');

  if (r.focus === true) pass('focus indicator present');
  else fail('no focus indicator');
}

const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();

await page.goto(URL);
await page.waitForTimeout(500);
await audit(page, 'landing');

await page.locator('input[type=file]').setInputFiles(SAMPLE);
await page.getByRole('tab', { name: 'Reading order' }).waitFor();
await page.waitForTimeout(700);
await audit(page, 'overlay view');

await page.getByRole('tab', { name: 'Reading view' }).click();
await page.waitForTimeout(600);
await audit(page, 'reading view');

await page.emulateMedia({ colorScheme: 'dark' });
await page.goto(URL);
await page.waitForTimeout(400);
await audit(page, 'landing (dark)');

const mob = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mp = await mob.newPage();
await mp.goto(URL);
await mp.waitForTimeout(400);
console.log('\n=== mobile 390px ===');
const mr = await mp.evaluate(IN_PAGE);
if (mr.overflow > 2) fail(`horizontal overflow ${mr.overflow}px`);
else pass('no horizontal overflow');
if (mr.tiny.length) fail(`text below 12px: ${mr.tiny.join(',')}`);
else pass('no text below 12px');
if (mr.small.length) fail(`targets < 24px: ${mr.small.join(' | ')}`);
else pass('all targets >= 24px');

await browser.close();
console.log(`\n${failures === 0 ? 'PASS — no measured design failures' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
