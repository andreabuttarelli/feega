import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIBRARY = resolve(HERE, '../../packages/library');
const PAGE = resolve(LIBRARY, 'preview/index.html');
const OUT = resolve(HERE, '../static/templates-shots');
const VIEWPORT = { width: 1280, height: 900 };
const THUMB = { width: 640, height: 400 };
const QUALITY = 78;
const BACKGROUNDS = { light: '#f7f6f2', dark: '#050505' } as const;

type Theme = keyof typeof BACKGROUNDS;

const ids = readdirSync(resolve(LIBRARY, 'items'));
const only = process.argv.slice(2);
const picks = only.length ? only : ids;

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: VIEWPORT });
await page.goto(`file://${PAGE}`);
await page.addStyleTag({ content: 'body{padding:0!important}.intro,.item > h2{display:none}.item{max-width:none!important;margin:0!important}.frame{border-radius:0!important;margin:0!important;box-shadow:none!important}' });
await page.evaluate(() => document.fonts.ready);

for (const id of picks) {
  for (const theme of Object.keys(BACKGROUNDS) as Theme[]) {
    const frame = page.locator(`[data-frame="${id}-${theme}"]`);
    await frame.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);

    const raw = await frame.screenshot();
    const scaled = await sharp(raw).resize({ width: THUMB.width }).toBuffer();
    const { height } = await sharp(scaled).metadata();
    const padded = await sharp(scaled)
      .extend({ bottom: Math.max(0, THUMB.height - (height ?? 0)), background: BACKGROUNDS[theme] })
      .toBuffer();

    await sharp(padded)
      .extract({ left: 0, top: 0, width: THUMB.width, height: THUMB.height })
      .webp({ quality: QUALITY })
      .toFile(resolve(OUT, `${id}-${theme}.webp`));
  }
}

await browser.close();
console.log(`${picks.length} templates, ${picks.length * 2} thumbnails`);
