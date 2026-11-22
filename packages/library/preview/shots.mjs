import { chromium } from '@playwright/test';
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAGE = join(dirname(fileURLToPath(import.meta.url)), 'index.html');
const OUT = process.argv[2];
const PICKS = readdirSync(join(dirname(PAGE), '..', 'items'));
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: '375', width: 375, height: 800 }
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

for (const viewport of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  await page.goto(`file://${PAGE}`);
  for (const id of PICKS) {
    for (const theme of ['light', 'dark']) {
      const frame = page.locator(`[data-frame="${id}-${theme}"]`);
      const path = join(OUT, `${id}-${theme}-${viewport.name}.png`);
      if (id !== 'modal') {
        await frame.screenshot({ path });
        continue;
      }
      await frame.locator('button').first().click();
      await page.waitForTimeout(600);
      await page.screenshot({ path });
      await page.keyboard.press('Escape');
    }
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(viewport.name, 'horizontal overflow px:', overflow);
  await page.close();
}

await browser.close();
