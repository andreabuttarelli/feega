import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { outlineScript } from '../../src/lib/server/url-import/page-outline';
import { TREE_LIMITS } from '../../src/lib/server/url-import/page-tree';

const VIEWPORT = { width: 1280, height: 800 };
const SETTLE_MS = 3_000;
const NAV_TIMEOUT_MS = 60_000;
const SCROLL_STEP_PX = 700;
const SCROLL_PAUSE_MS = 500;

const [url, out] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: tsx scripts/url-import/capture-outline.ts <url> <out.json>');
  process.exit(1);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: VIEWPORT, locale: 'en-US' });
  await page.goto(url, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS }).catch(() => undefined);
  const full = Math.min(TREE_LIMITS.height, await page.evaluate(() => document.documentElement.scrollHeight));
  for (let y = 0; y < full; y += SCROLL_STEP_PX) {
    await page.evaluate((to) => window.scrollTo(0, to), y);
    await page.waitForTimeout(SCROLL_PAUSE_MS);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(SETTLE_MS);
  const height = Math.min(TREE_LIMITS.height, await page.evaluate(() => document.documentElement.scrollHeight));
  writeFileSync(out, JSON.stringify(await page.evaluate(outlineScript(height))));
  console.log(out, height);
} finally {
  await browser.close();
}
