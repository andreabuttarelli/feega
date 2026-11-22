import { chromium } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAGE = join(dirname(fileURLToPath(import.meta.url)), 'index.html');
const OUT = process.argv[2];
const GRID = 'body{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0 2rem;align-items:start}.intro{grid-column:1/-1;text-align:center}.item{max-width:none;width:100%;margin:0 0 2rem}.frame{max-height:1100px}.frame[data-theme="dark"]{display:none}';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 5120, height: 1000 } });
await page.goto(`file://${PAGE}`);
await page.addStyleTag({ content: GRID });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT, fullPage: true, scale: 'css' });
await browser.close();
