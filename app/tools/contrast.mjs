/**
 * Contrast audit for the theme palette.
 *
 * Every foreground/background pair we actually use must clear WCAG AA (4.5:1 for
 * body text, 3:1 for large text and UI components). Checking this by eye is how
 * accessibility bugs ship, so we compute it.
 */
const hex = (h) => {
  const n = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
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

const light = {
  '--ink-900': '#14161a',
  '--ink-700': '#33383f',
  '--ink-500': '#5b636e',
  '--ink-400': '#7c858f',
  '--ink-300': '#a6aeb8',
  '--paper-000': '#ffffff',
  '--paper-050': '#fbfaf7',
  '--paper-100': '#f4f2ec',
  '--accent-600': '#0f6f6c',
  '--accent-700': '#0b5754',
  '--caution-700': '#8a5a00',
  '--danger-700': '#9b2c2c',
};

const dark = {
  '--ink-900': '#f2f0ea',
  '--ink-700': '#d4d1c8',
  '--ink-500': '#a8a49a',
  '--ink-400': '#8b877e',
  '--ink-300': '#6b6860',
  '--paper-000': '#16181c',
  '--paper-050': '#1c1f24',
  '--paper-100': '#22262c',
  '--accent-600': '#5fd3cb',
  '--accent-700': '#8ce4dd',
  '--caution-700': '#f0c069',
  '--danger-700': '#f08a8a',
};

function audit(name, p) {
  console.log(`\n=== ${name} ===`);
  const bgs = ['--paper-000', '--paper-050', '--paper-100'];
  let fails = 0;
  for (const fg of ['--ink-900', '--ink-700', '--ink-500', '--ink-400', '--ink-300', '--accent-600', '--accent-700', '--caution-700', '--danger-700']) {
    for (const bg of bgs) {
      const r = ratio(p[fg], p[bg]);
      const ok = r >= 4.5;
      // --ink-300 is decorative only (borders); do not require body contrast.
      const exempt = fg === '--ink-300';
      if (!ok && !exempt) {
        fails++;
        console.log(`  FAIL ${fg} on ${bg}: ${r.toFixed(2)}:1`);
      }
    }
  }
  if (!fails) console.log('  all text pairs pass 4.5:1');
  return fails;
}

const a = audit('light', light);
const b = audit('dark', dark);

console.log(`\n--- candidate replacements for --ink-400 ---`);
for (const c of ['#6b7480', '#697280', '#646d78', '#5f6873', '#727a85']) {
  console.log(`  ${c}  on #fbfaf7 = ${ratio(c, '#fbfaf7').toFixed(2)}  on #ffffff = ${ratio(c, '#ffffff').toFixed(2)} on #f4f2ec = ${ratio(c, '#f4f2ec').toFixed(2)}`);
}

console.log(`\n--- candidate replacements for dark --ink-400 ---`);
for (const c of ['#9a968c', '#a09c92', '#a8a49a', '#b0aca2']) {
  console.log(`  ${c}  on #1c1f24 = ${ratio(c, '#1c1f24').toFixed(2)}  on #16181c = ${ratio(c, '#16181c').toFixed(2)} on #22262c = ${ratio(c, '#22262c').toFixed(2)}`);
}

process.exit(a + b === 0 ? 0 : 1);
