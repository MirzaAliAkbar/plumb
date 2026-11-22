import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

await page.goto('https://plumb-akw.pages.dev/app?sample=1', { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(5000);

// Check for the tool UI elements
const tab = await page.locator('button[role="tab"]').first().textContent();
console.log('First tab:', tab);

const fileName = await page.locator('.result__name').textContent();
console.log('File name:', fileName);

const confidence = await page.locator('.confidence__pct').textContent();
console.log('Confidence:', confidence);

// Check for error
const error = await page.locator('.toast--error, [role="alert"]').first().textContent({ timeout: 5000 }).catch(() => null);
console.log('ERROR:', error);

await browser.close();
