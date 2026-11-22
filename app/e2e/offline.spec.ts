import { test, expect } from '@playwright/test';
import path from 'node:path';

const SAMPLE = path.resolve('public/samples/two-column-paper.pdf');

test.describe('offline support', () => {
  test('still loads and analyses a PDF with the network cut', async ({ page, context }) => {
    // Warm the shell from the tool page: that is where a file input lives.
    await page.goto('/app');
    await page.waitForLoadState('networkidle');

    // Wait for the service worker to take control of this page.
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null, undefined, {
      timeout: 20_000,
    });

    // Reload once so the navigation itself is served by the worker.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Cut the network entirely.
    await context.setOffline(true);

    // The app shell must still come from cache.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });

    // And analysis must still work, because it is entirely local — including
    // pdf.js's worker and its font data, which is why those are precached.
    await page.locator('input[type="file"]').setInputFiles(SAMPLE);
    await expect(page.getByRole('tab', { name: 'Reading order' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('svg[role="group"] g[role="button"]').first()).toBeVisible();

    await context.setOffline(false);
  });
});
