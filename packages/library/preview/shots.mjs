import { chromium } from '@playwright/test';
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAGE = join(dirname(fileURLToPath(import.meta.url)), 'index.html');
const [OUT, ...ONLY] = process.argv.slice(2);
const PICKS = ONLY.length ? ONLY : readdirSync(join(dirname(PAGE), '..', 'items'));
const DIALOGS = ['modal'];
const MENUS = { 'navbar-mega': '34rem', 'navbar-centered': '20rem', 'dropdown-menu': '16rem' };
const VIEWPORTS = [
  { name: '1280', width: 1280, height: 900 },
  { name: '375', width: 375, height: 800 }
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

for (const viewport of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 2 });
  await page.goto(`file://${PAGE}`);
  await page.addStyleTag({ content: 'body{padding:0!important}.intro,.item > h2{display:none}.item{max-width:none!important;margin:0!important}.frame{border-radius:0!important;margin:0!important}' });
  await page.evaluate(() => document.fonts.ready);

  for (const id of PICKS) {
    for (const theme of ['light', 'dark']) {
      const frame = page.locator(`[data-frame="${id}-${theme}"]`);
      const path = join(OUT, `${id}-${theme}-${viewport.name}.png`);

      if (DIALOGS.includes(id)) {
        await frame.locator('button').first().click();
        await page.waitForTimeout(600);
        await page.screenshot({ path });
        await page.keyboard.press('Escape');
        continue;
      }

      if (MENUS[id]) {
        await frame.evaluate((el, height) => {
          el.style.minHeight = height;
          const menu = [...el.querySelectorAll('details')].find((d) => getComputedStyle(d).display !== 'none');
          if (menu) {
            menu.open = true;
          }
        }, MENUS[id]);
      }

      await frame.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await frame.screenshot({ path });
    }
  }

  await page.close();
}

await browser.close();
