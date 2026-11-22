import { chromium } from 'playwright';
import path from 'node:path';

/**
 * Capture the Devpost gallery images.
 *
 * Defaults to the live deployment. Pass a base URL as argv[2] to shoot a local
 * preview, e.g. `npx tsx tools/shoot.mts http://127.0.0.1:4174`.
 */
const BASE = process.argv[2] ?? 'https://plumb-akw.pages.dev';

const browser = await chromium.launch();
const shot = async (name, w, h, fn) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await fn(page);
  await page.screenshot({ path: `../shots/${name}.png`, fullPage: false });
  await ctx.close();
  console.log('shot', name);
};

const SAMPLE = path.resolve('public/samples/two-column-paper.pdf');

await shot('01-landing', 1440, 1000, async (page) => {
  await page.goto(BASE);
  await page.waitForTimeout(600);
});

await shot('02-landing-mobile', 390, 844, async (page) => {
  await page.goto(BASE);
  await page.waitForTimeout(600);
});

const TOOL = `${BASE.replace(/\/$/, '')}/app`;

await shot('03-overlay', 1440, 1500, async (page) => {
  await page.goto(TOOL);
  await page.locator('input[type=file]').setInputFiles(SAMPLE);
  await page.getByRole('tab', { name: 'Reading order' }).waitFor();
  // Wait for the raster page, otherwise the shot shows empty paper.
  await page.locator('svg[role="group"] image').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(400);
});

await shot('04-compare', 1440, 1100, async (page) => {
  await page.goto(TOOL);
  await page.locator('input[type=file]').setInputFiles(SAMPLE);
  await page.getByRole('tab', { name: 'Reading order' }).waitFor();
  await page.getByRole('tab', { name: 'Before / after' }).click();
  await page.waitForTimeout(400);
});

await shot('05-reading', 1440, 1100, async (page) => {
  await page.goto(TOOL);
  await page.locator('input[type=file]').setInputFiles(SAMPLE);
  await page.getByRole('tab', { name: 'Reading order' }).waitFor();
  await page.getByRole('tab', { name: 'Reading view' }).click();
  await page.waitForTimeout(700);
});

await shot('06-overlay-dark', 1440, 1500, async (page) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(TOOL);
  await page.locator('input[type=file]').setInputFiles(SAMPLE);
  await page.getByRole('tab', { name: 'Reading order' }).waitFor();
  await page.locator('svg[role="group"] image').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(400);
});

await browser.close();
