import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer, { type Page } from 'puppeteer-core';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { localBrowser } from '$lib/server/web/browser';
import { capturedIn, FIDELITY_PAGES } from './fidelity-pages';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { PageTree } from './page-tree';
import { RevealMode } from './page-reveal';
import { PAGE_VIEWS } from './page-views';
import { pagePrepared, PLAIN_PLANNER } from './import-url';

const LABEL = process.env.URL_IMPORT_CAPTURE ?? '';
const ONLY = process.env.URL_IMPORT_ONLY?.split(',');
const SETTLE_MS = 1_200;
const BAND_PX = 4_000;

async function fullShot(page: Page): Promise<Buffer> {
  const { width, height } = await page.evaluate(() => ({ width: document.documentElement.clientWidth, height: Math.min(Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0), 65_536) }));
  const bands: { input: Buffer; top: number; left: number }[] = [];
  for (let top = 0; top < height; top += BAND_PX) {
    const clip = { x: 0, y: top, width, height: Math.min(BAND_PX, height - top) };
    bands.push({ input: Buffer.from(await page.screenshot({ type: 'png', clip, captureBeyondViewport: true })), top, left: 0 });
  }
  return sharp({ create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } } }).composite(bands).png().toBuffer();
}

const paintedTexts = (n: RestNode): string[] => (n.collapsed ? [] : [...(n.type === 'TEXT' ? [n.characters ?? ''] : []), ...(n.children ?? []).flatMap(paintedTexts)]);

const VIEWS = process.env.URL_IMPORT_VIEWS ? PAGE_VIEWS : [];

const PAGES = Object.entries(FIDELITY_PAGES).filter(([name]) => !ONLY || ONLY.includes(name));

describe.runIf(LABEL && process.env.CHROMIUM_PATH)('capture a page as the import reads it, and its screenshot', () => {
  it.each(PAGES)('%s', async (name, url) => {
    const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, headless: 'shell' });
    try {
      let page: Page | null = null;
      const open = localBrowser(async () => (page = await browser.newPage()));
      const tab = await open();
      const refusal = await pagePrepared(tab, new URL(url), SETTLE_MS, PLAIN_PLANNER);
      const dir = capturedIn(LABEL);
      mkdirSync(dir, { recursive: true });
      const folded = await page!.evaluate(() => [...document.querySelectorAll('details:not([open]) > :not(summary)')].map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)).filter((text) => text && !document.body.innerText.replace(/\s+/g, ' ').includes(text)));
      const navWords = await page!.evaluate(() =>
        [...document.querySelectorAll('header a, header button, nav a, nav button')]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            const seen = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return r.width > 0 && r.height > 0 && r.top + window.scrollY < 120 && el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && Boolean(seen && (el === seen || el.contains(seen)));
          })
          .flatMap((el) => ((el as HTMLElement).innerText ?? '').split(/\s+/))
          .filter(Boolean)
      );
      const tree = (await tab.tree()) as PageTree;
      writeFileSync(join(dir, `${name}.json`), JSON.stringify(tree));
      await tab.reveal(RevealMode.Still);
      writeFileSync(join(dir, `${name}-source.png`), await fullShot(page!));

      for (const view of VIEWS) {
        const narrow = await open();
        await narrow.viewport(view.width);
        await pagePrepared(narrow, new URL(url), SETTLE_MS, PLAIN_PLANNER);
        writeFileSync(join(dir, `${name}@${view.width}.json`), JSON.stringify(await narrow.tree()));
        await narrow.reveal(RevealMode.Still);
        writeFileSync(join(dir, `${name}@${view.width}-source.png`), await fullShot(page!));
      }

      expect(refusal).toBeNull();
      expect(tree.root).toBeDefined();
      expect(paintedTexts(tree.root).filter((t) => folded.some((f) => t.startsWith(f)))).toEqual([]);
      expect([...new Set(navWords)].filter((word) => !paintedTexts(tree.root).join(' ').includes(word))).toEqual([]);
    } finally {
      await browser.close();
    }
  }, 240_000);
});
