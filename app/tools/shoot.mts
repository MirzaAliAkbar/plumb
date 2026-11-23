import { chromium } from 'playwright';
import path from 'node:path';

/**
 * Capture the Devpost gallery images.
 *
 * Defaults to the live deployment. Pass a base URL as argv[2] to shoot a local
 * preview, e.g. `npx tsx tools/shoot.mts http://127.0.0.1:4174`.
 *
 * Light is the default theme; `06-overlay-dark` opts in via localStorage, which
 * the inline head script reads before first paint.
 */
const BASE = process.argv[2] ?? 'https://plumb-akw.pages.dev';

const browser = await chromium.launch();
const shot = async (name, w, h, fn, init) => {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1.5,
  });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  await fn(page);
  // Let the last transition / hover settle before the capture.
  await page.waitForTimeout(450);
  await page.screenshot({ path: `../shots/${name}.png`, fullPage: false });
  await ctx.close();
  console.log('shot', name);
};

const SAMPLE = path.resolve('public/samples/two-column-paper.pdf');
const TOOL = `${BASE.replace(/\/$/, '')}/app`;

const openSample = async (page) => {
  await page.goto(TOOL);
  await page.locator('input[type=file]').setInputFiles(SAMPLE);
  await page.getByRole('tab', { name: 'Reading order' }).waitFor({ timeout: 30_000 });
  // Wait for the raster page, otherwise the shot shows empty paper.
  await page.locator('svg[role="group"] image').waitFor({ timeout: 20_000 });
};

await shot('01-landing', 1600, 1111, async (page) => {
  await page.goto(BASE);
  await page.getByRole('heading', { level: 1 }).waitFor();
});

await shot('02-landing-mobile', 390, 844, async (page) => {
  await page.goto(BASE);
  await page.getByRole('heading', { level: 1 }).waitFor();
});

await shot('03-overlay', 1600, 1667, async (page) => {
  await openSample(page);
  const blocks = page.locator('svg[role="group"] g[role="button"]');
  if (await blocks.count()) await blocks.nth(2).hover().catch(() => {});
});

await shot('04-compare', 1600, 1222, async (page) => {
  await openSample(page);
  await page.getByRole('tab', { name: 'Before / after' }).click();
});

await shot('05-reading', 1600, 1222, async (page) => {
  await openSample(page);
  await page.getByRole('tab', { name: 'Reading view' }).click();
});

await shot(
  '06-overlay-dark',
  1600,
  1667,
  async (page) => {
    await openSample(page);
  },
  () => {
    localStorage.setItem('plumb-theme', 'dark');
  },
);

await browser.close();