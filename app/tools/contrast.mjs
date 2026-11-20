/**
 * Contrast audit for the theme palette.
 *
 * Every foreground/background pair we actually use must clear WCAG AA (4.5:1 for
 * body text, 3:1 for large text and UI components). Checking this by eye is how
 * accessibility bugs ship, so we compute it.
 *
 * The palette is PARSED FROM theme.css rather than copied here. An earlier
 * version kept a duplicate palette in this file, it drifted from the real tokens,
 * and CI reported a failure on a colour the app no longer used. One source of
 * truth, or the audit measures fiction.
 */
import fs from 'node:fs';
import path from 'node:path';

const CSS = path.resolve(import.meta.dirname, '../src/styles/theme.css');

const hex = (h) => {
  const n = h.trim().replace('#', '');
  const full = n.length === 3 ? [...n].map((c) => c + c).join('') : n;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
};

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

const L = (h) => {
  const [r, g, b] = hex(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a, b) => {
  const la = L(a);
  const lb = L(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** Pull `--token: #hex;` declarations out of one block of CSS text. */
function readTokens(block) {
  const out = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

const css = fs.readFileSync(CSS, 'utf8');

// The light palette is the first `:root { ... }`; the dark one is the `:root`
// nested inside the prefers-color-scheme media query.
const rootBlocks = [...css.matchAll(/:root\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]);
if (rootBlocks.length < 2) {
  console.error(`Could not find both palettes in ${CSS} (found ${rootBlocks.length}).`);
  process.exit(1);
}
const light = readTokens(rootBlocks[0]);
const dark = readTokens(rootBlocks[1]);

// Only pairs that are actually rendered as text or meaningful UI. Ink-300 is
// decorative borders only, so it is exempt.
const FOREGROUNDS = [
  '--ink-900',
  '--ink-700',
  '--ink-500',
  '--ink-400',
  '--accent-600',
  '--accent-700',
  '--caution-700',
  '--danger-700',
];
const BACKGROUNDS = ['--paper-000', '--paper-050', '--paper-100'];

function audit(name, p) {
  console.log(`\n=== ${name} ===`);
  let fails = 0;
  let checked = 0;
  for (const fg of FOREGROUNDS) {
    for (const bg of BACKGROUNDS) {
      if (!p[fg] || !p[bg]) {
        console.log(`  MISSING ${fg} or ${bg} in theme.css`);
        fails++;
        continue;
      }
      checked++;
      const r = ratio(p[fg], p[bg]);
      if (r < 4.5) {
        fails++;
        console.log(`  FAIL ${fg} (${p[fg]}) on ${bg} (${p[bg]}): ${r.toFixed(2)}:1`);
      }
    }
  }
  if (!fails) console.log(`  all ${checked} text pairs pass 4.5:1`);
  return fails;
}

const a = audit('light', light);
const b = audit('dark', dark);

console.log(`\nPalette source: ${path.relative(process.cwd(), CSS)}`);
process.exit(a + b === 0 ? 0 : 1);
