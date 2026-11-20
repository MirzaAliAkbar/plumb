import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';
import fs from 'node:fs';

const SAMPLE = path.resolve('public/samples/two-column-paper.pdf');

async function loadSample(page: import('@playwright/test').Page) {
  const input = page.locator('input[type="file"]');
  await input.setInputFiles(SAMPLE);
  // The overlay appears once analysis finishes.
  await expect(page.getByRole('tab', { name: 'Reading order' })).toBeVisible({ timeout: 30_000 });
}

test.describe('Plumb', () => {
  test('landing page has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('rejects a non-PDF file with an announced error', async ({ page }) => {
    await page.goto('/');
    const tmp = path.join(process.cwd(), 'e2e', 'not-a-pdf.txt');
    fs.writeFileSync(tmp, 'hello');
    await page.locator('input[type="file"]').setInputFiles(tmp);
    await expect(page.getByRole('alert')).toContainText('not a PDF');
    fs.unlinkSync(tmp);
  });

  test('analyses the sample PDF and shows a numbered overlay', async ({ page }) => {
    await page.goto('/');
    await loadSample(page);

    // The overlay must actually contain numbered blocks.
    const svg = page.locator('svg[role="group"]');
    await expect(svg).toBeVisible();
    const blocks = svg.locator('g[role="button"]');
    expect(await blocks.count()).toBeGreaterThan(3);

    await expect(page.getByText(/Page 1 of 1/)).toBeVisible();
  });

  test('overlay blocks are keyboard reachable', async ({ page }) => {
    await page.goto('/');
    await loadSample(page);
    const first = page.locator('svg[role="group"] g[role="button"]').first();
    await expect(first).toHaveAttribute('tabindex', '0');
  });

  test('reading view renders semantic headings and paragraphs', async ({ page }) => {
    await page.goto('/');
    await loadSample(page);
    await page.getByRole('tab', { name: 'Reading view' }).click();

    const article = page.getByRole('article');
    await expect(article).toBeVisible();
    // Real structure, not divs with font sizes.
    expect(await article.locator('h2, h3').count()).toBeGreaterThan(0);
    expect(await article.locator('p').count()).toBeGreaterThan(2);
  });

  test('reading view has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await loadSample(page);
    await page.getByRole('tab', { name: 'Reading view' }).click();
    await expect(page.getByRole('article')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('downloads a semantic HTML copy', async ({ page }) => {
    await page.goto('/');
    await loadSample(page);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download accessible HTML/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/accessible\.html$/);

    const file = await download.path();
    const html = fs.readFileSync(file!, 'utf8');
    expect(html).toContain('<h1>');
    expect(html).toContain('<p>');
    expect(html).toContain('lang="en"');
  });

  test('the two-column fix is real: right column follows left', async ({ page }) => {
    await page.goto('/');
    await loadSample(page);
    await page.getByRole('tab', { name: 'Reading view' }).click();

    const text = await page.getByRole('article').innerText();
    const leftEnd = text.indexOf('reach');
    const rightStart = text.indexOf('Results');
    // Left column content ("reach: it works on documents nobody...") must be
    // read before the right column begins.
    expect(leftEnd).toBeGreaterThan(-1);
    expect(rightStart).toBeGreaterThan(leftEnd);
  });

  test('works at 200% zoom without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
  });
});
