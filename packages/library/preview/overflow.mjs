import { chromium } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WIDTHS = [360, 375, 768, 1024, 1280];
const PAGE = join(dirname(fileURLToPath(import.meta.url)), 'index.html');
const FLUSH = 'body{padding:0!important}.intro,.item > h2{display:none}.item{max-width:none!important}';

export async function findOverflow(widths = WIDTHS) {
  const browser = await chromium.launch();
  const found = [];

  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`file://${PAGE}`);
    await page.addStyleTag({ content: FLUSH });
    const frames = await page.evaluate(() =>
      [...document.querySelectorAll('.frame')]
        .filter((frame) => frame.scrollWidth > frame.clientWidth + 1)
        .map((frame) => `${frame.dataset.frame} ${frame.scrollWidth}/${frame.clientWidth}`)
    );
    found.push(...frames.map((frame) => `${width}px ${frame}`));
    await page.close();
  }

  await browser.close();
  return found;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const found = await findOverflow();
  console.log(found.length ? found.join('\n') : 'no horizontal overflow');
  process.exitCode = found.length ? 1 : 0;
}
