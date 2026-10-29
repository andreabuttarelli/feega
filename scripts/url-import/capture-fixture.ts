import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { pageTreeOf, TREE_LIMITS } from '../../src/lib/server/url-import/page-tree';

const VIEWPORT = { width: 1280, height: 800 };
const SETTLE_MS = 1_500;
const NAV_TIMEOUT_MS = 45_000;

const [url, out, shot] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: tsx scripts/url-import/capture-fixture.ts <url> <tree.json> [shot.png]');
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: VIEWPORT });
await page.goto(url, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS }).catch(() => undefined);
for (let y = 0; y < 3840; y += 640) {
  await page.mouse.wheel(0, 640);
  await page.waitForTimeout(200);
}
await page.waitForTimeout(SETTLE_MS);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);
const tree = await page.evaluate(`var __name = (f) => f; (${pageTreeOf.toString()})(${JSON.stringify(TREE_LIMITS)})`);
writeFileSync(out, JSON.stringify(tree));
if (shot) {
  await page.screenshot({ path: shot, fullPage: true });
}
await browser.close();
console.log(out, JSON.stringify(tree).length);
