import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';
import fs from 'node:fs';

const SAMPLE = path.resolve('public/samples/two-column-paper.pdf');

async function loadSample(page: import('@playwright/test').Page) {
  await page.goto('/app');
  const input = page.locator('input[type="file"]');
  await input.setInputFiles(SAMPLE);
  // The overlay appears once analysis finishes.
  await expect(page.getByRole('tab', { name: 'Reading order' })).toBeVisible({ timeout: 30_000 });
}

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.describe('Landing page', () => {
  test('has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('makes the argument and links to the tool', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('reading order');
    // The claim must be checkable without an account.
    await expect(
      page.getByRole('link', { name: /Open the two-column sample/i }).first(),
    ).toBeVisible();
  });

  test('opens the sample from the landing page in one click', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Open the two-column sample/i }).first().click();
    // The sample loads by itself; no file picker and no account.
    await expect(page.getByRole('tab', { name: 'Reading order' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('svg[role="group"] g[role="button"]').first()).toBeVisible();
  });

  test('states its limitations rather than hiding them', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /What Plumb does not do/i })).toBeVisible();
    await expect(page.getByText(/no OCR/i)).toBeVisible();
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

test.describe('Tool', () => {
  test('rejects a non-PDF file with an announced error', async ({ page }) => {
    await page.goto('/app');
    const tmp = path.join(process.cwd(), 'e2e', 'not-a-pdf.txt');
    fs.writeFileSync(tmp, 'hello');
    await page.locator('input[type="file"]').setInputFiles(tmp);
    await expect(page.getByRole('alert')).toContainText('not a PDF');
    fs.unlinkSync(tmp);
  });

  test('names the real reason a file fails, instead of one generic sentence', async ({
    page,
  }) => {
    await page.goto('/app');
    // A file with a .pdf name that is actually HTML: the commonest real cause of
    // "it will not open", and it must be reported as such.
    const tmp = path.join(process.cwd(), 'e2e', 'fake.pdf');
    fs.writeFileSync(tmp, '<!doctype html><html><body>not a pdf</body></html>');
    await page.locator('input[type="file"]').setInputFiles(tmp);

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/not a PDF/i, {
      timeout: 20_000,
    });
    // The old catch-all must be gone.
    await expect(page.getByText(/password-protected or damaged/i)).toHaveCount(0);
    fs.unlinkSync(tmp);
  });

  test('analyses the sample PDF and shows a numbered overlay', async ({ page }) => {
    await loadSample(page);

    const svg = page.locator('svg[role="group"]');
    await expect(svg).toBeVisible();
    const blocks = svg.locator('g[role="button"]');
    expect(await blocks.count()).toBeGreaterThan(3);

    await expect(page.getByText(/Page 1 of 2/)).toBeVisible();
  });

  test('draws the real page behind the numbered overlay', async ({ page }) => {
    await loadSample(page);
    // The bitmap is what turns floating boxes into an audit of a document.
    const image = page.locator('svg[role="group"] image');
    await expect(image).toHaveAttribute('href', /^data:image\/png;base64,/, {
      timeout: 20_000,
    });
    const src = await image.getAttribute('href');
    expect(src!.length).toBeGreaterThan(10_000);
  });

  test('shows the stored order beside the repaired order', async ({ page }) => {
    await loadSample(page);
    await page.getByRole('tab', { name: 'Before / after' }).click();

    const stored = page.getByRole('region', { name: 'What the file stores' });
    const repaired = page.getByRole('region', { name: 'What Plumb reads' });
    await expect(stored).toBeVisible();
    await expect(repaired).toBeVisible();

    // The sample is generated with an interleaved stream, so the two orders
    // must genuinely differ. If the generator ever regresses, this fails.
    const storedText = await stored.innerText();
    const repairedText = await repaired.innerText();
    expect(storedText).not.toBe(repairedText);
    // The sample is interleaved line by line, so most lines move even though
    // the blocks that contain them are coarser.
    await expect(page.getByText(/lines are in a different position/)).toBeVisible();
    await expect(page.getByText(/of 7 move/)).toBeVisible();
    await expect(page.getByLabel(/each cell is one line of text/)).toBeVisible();
  });

  test('overlay blocks are keyboard reachable', async ({ page }) => {
    await loadSample(page);
    const first = page.locator('svg[role="group"] g[role="button"]').first();
    await expect(first).toHaveAttribute('tabindex', '0');
  });

  test('reading view renders semantic headings and paragraphs', async ({ page }) => {
    await loadSample(page);
    await page.getByRole('tab', { name: 'Reading view' }).click();

    const article = page.getByRole('article');
    await expect(article).toBeVisible();
    // Real structure, not divs with font sizes.
    expect(await article.locator('h2, h3').count()).toBeGreaterThan(0);
    expect(await article.locator('p').count()).toBeGreaterThan(2);
  });

  test('reading view has no accessibility violations', async ({ page }) => {
    await loadSample(page);
    await page.getByRole('tab', { name: 'Reading view' }).click();
    await expect(page.getByRole('article')).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });

  test('downloads a semantic HTML copy', async ({ page }) => {
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
    await loadSample(page);
    await page.getByRole('tab', { name: 'Reading view' }).click();

    const text = await page.getByRole('article').innerText();
    const leftEnd = text.indexOf('nobody will ever remediate');
    const rightStart = text.indexOf('Results');
    // The end of the left column must be read before the right column begins.
    expect(leftEnd).toBeGreaterThan(-1);
    expect(rightStart).toBeGreaterThan(leftEnd);
  });
});

test.describe('Routing', () => {
  test('serves the app shell for a deep link', async ({ page }) => {
    await page.goto('/app');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Repair a PDF/i);
  });

  test('shows a real 404 page rather than a blank screen', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/does not exist/i);
  });

  test('sign-in page renders the Clerk form', async ({ page }) => {
    await page.goto('/sign-in');
    // Clerk mounts its own component; assert on the card it always renders.
    await expect(page.locator('.cl-card').first()).toBeVisible({ timeout: 20_000 });
  });
});
