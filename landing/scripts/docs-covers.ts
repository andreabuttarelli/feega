import { mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { coverFor } from '../src/lib/site/alternatives/cover.ts';
import { COVERS_DIR, COVER_HEIGHT, COVER_WIDTH, docsPages } from '../../web-docs/src/docs-pages.mjs';
import { baseCss, coverHtml } from './cover-render.ts';

const SIZE = { width: COVER_WIDTH, height: COVER_HEIGHT };
const WEBP_QUALITY = 70;
const HASH_BASE = 31;

const indexOf = (id: string) => [...id].reduce((h, c) => (h * HASH_BASE + c.charCodeAt(0)) >>> 0, 7);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });

for (const doc of docsPages()) {
  const { shape, ramp, flag } = coverFor(indexOf(doc.id));
  const kicker = doc.section ? `Feega docs · ${doc.section}` : 'Feega docs';
  const html = coverHtml(SIZE, { kicker, title: doc.title, sub: doc.section ? 'docs.feega.app' : 'Design in your codebase', shape, ramp, flag });
  await page.setContent(`<!doctype html><html><head><style>${baseCss(SIZE)}</style></head><body>${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: 'png' });
  const base = resolve(COVERS_DIR, doc.id);
  mkdirSync(dirname(base), { recursive: true });
  await sharp(png).png({ palette: true, quality: 80, effort: 10 }).toFile(`${base}.png`);
  await sharp(png).webp({ quality: WEBP_QUALITY, effort: 6 }).toFile(`${base}.webp`);
  console.log(doc.id, Math.round(statSync(`${base}.png`).size / 1024), 'KB png', Math.round(statSync(`${base}.webp`).size / 1024), 'KB webp');
}

await browser.close();
