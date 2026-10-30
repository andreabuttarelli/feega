import puppeteer, { type Page } from 'puppeteer-core';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import type { RestNode } from '$lib/server/figma/rest-message';
import { localBrowser } from '$lib/server/web/browser';
import { TREE_LIMITS, treeScript, type PageTree } from './page-tree';

const PAGE = `<body style="margin:0;background:oklch(0.98 0 0)"><div style="width:200px;height:80px;background:oklch(0.21 0.034 264.665);color:oklch(0.985 0.002 247.839);font:16px sans-serif">Download</div></body>`;

describe.runIf(process.env.CHROMIUM_PATH)('pageTreeOf in a real browser', () => {
  it('i colori oklch di Tailwind 4 diventano riempimenti e testo, non spariscono', async () => {
    const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, headless: 'shell' });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 400, height: 200 });
      await page.setContent(PAGE);
      const tree = (await page.evaluate(treeScript(TREE_LIMITS))) as PageTree;
      const all = (n: RestNode): RestNode[] => [n, ...(n.children ?? []).flatMap(all)];
      const nodes = all(tree.root);
      const dark = nodes.find((n) => n.type === 'FRAME' && n.fills?.some((f) => f.color && f.color.b > f.color.r && f.color.r < 0.2));

      expect(dark).toBeDefined();
      expect(nodes.find((n) => n.type === 'TEXT')).toMatchObject({ characters: 'Download' });
    } finally {
      await browser.close();
    }
  }, 30_000);
});

const WRAPPED = `<body style="margin:0"><p style="margin:0;width:300px;font:20px monospace">aaaa bbbb cccc dddd eeee ffff gggg</p></body>`;

describe.runIf(process.env.CHROMIUM_PATH)('a paragraph that wraps', () => {
  it('is as wide as halfway to where the next word would fit, so a font a hair wider breaks the same lines (stripe: "SaaS" fell to the next line)', async () => {
    const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, headless: 'shell' });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 400, height: 200 });
      await page.setContent(WRAPPED);
      const tree = (await page.evaluate(treeScript(TREE_LIMITS))) as PageTree;
      const all = (n: RestNode): RestNode[] => [n, ...(n.children ?? []).flatMap(all)];
      const [widest, word] = await page.evaluate(() => {
        const text = document.querySelector('p')!.firstChild as Text;
        const range = document.createRange();
        range.setStart(text, 0);
        range.setEnd(text, 24);
        const line = range.getBoundingClientRect().width;
        range.setStart(text, 25);
        range.setEnd(text, 29);
        return [line, range.getBoundingClientRect().width];
      });
      const width = all(tree.root).find((n) => n.type === 'TEXT')!.absoluteBoundingBox!.width;

      expect(width).toBeGreaterThan(widest + word / 4);
      expect(width).toBeLessThan(widest + word);
    } finally {
      await browser.close();
    }
  }, 30_000);
});

const PARAGRAPHS = `<body style="margin:0"><p style="margin:0;width:200px;font:12px/16px monospace">one<br><br>two<br><br>three</p></body>`;

describe.runIf(process.env.CHROMIUM_PATH)('paragraphs split by blank lines in one text', () => {
  it('keep the line height of a line, not the average gap between the lines that have ink (apple footnotes came out a third taller)', async () => {
    const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, headless: 'shell' });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 400, height: 200 });
      await page.setContent(PARAGRAPHS);
      const tree = (await page.evaluate(treeScript(TREE_LIMITS))) as PageTree;
      const all = (n: RestNode): RestNode[] => [n, ...(n.children ?? []).flatMap(all)];
      const text = all(tree.root).find((n) => n.type === 'TEXT')!;

      expect(text.characters).toBe('one\n\ntwo\n\nthree');
      expect(text.style?.lineHeightPx).toBe(16);
      expect(text.absoluteBoundingBox?.height).toBe(80);
    } finally {
      await browser.close();
    }
  }, 30_000);
});

const CHIPPED = `<body style="margin:0"><p style="margin:0;width:600px;font:16px monospace">aa <code style="padding:0 6px;border:1px solid #888;border-radius:4px;background:#eee;font:16px monospace">bb</code> cc</p></body>`;

describe.runIf(process.env.CHROMIUM_PATH)('an inline chip with padding and a border', () => {
  it('keeps its room on each side as spacing after the letter before it and after its last letter (blog: text after every code chip slid left)', async () => {
    const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, headless: 'shell' });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 800, height: 200 });
      await page.setContent(CHIPPED);
      const tree = (await page.evaluate(treeScript(TREE_LIMITS))) as PageTree;
      const all = (n: RestNode): RestNode[] => [n, ...(n.children ?? []).flatMap(all)];
      const text = all(tree.root).find((n) => n.type === 'TEXT')!;
      const spacing = [...text.characters!].map((_, i) => text.styleOverrideTable?.[String(text.characterStyleOverrides?.[i] ?? 0)]?.letterSpacing ?? 0);

      expect(text.characters).toBe('aa bb cc');
      expect(spacing).toEqual([0, 0, 7, 0, 7, 0, 0, 0]);
      expect(all(tree.root).find((n) => n.type === 'RECTANGLE' && n.name === 'code')).toMatchObject({ strokes: [{ type: 'SOLID' }], strokeWeight: 1 });
    } finally {
      await browser.close();
    }
  }, 30_000);
});

const CLIPPED = `<body style="margin:0"><svg width="40" height="40" viewBox="0 0 20 20"><defs><clipPath id="c"><rect x="0" y="0" width="10" height="20"/></clipPath></defs><g clip-path="url(#c)"><circle cx="10" cy="10" r="8" fill="#e00"/></g></svg></body>`;

describe.runIf(process.env.CHROMIUM_PATH)('an svg clipped by a rectangle', () => {
  it('comes in as a clipping frame around its vectors, not a snapshot (stripe: 46 such icons used up every snapshot)', async () => {
    const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, headless: 'shell' });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 200, height: 100 });
      await page.setContent(CLIPPED);
      const tree = (await page.evaluate(treeScript(TREE_LIMITS))) as PageTree;
      const all = (n: RestNode): RestNode[] => [n, ...(n.children ?? []).flatMap(all)];
      const clip = all(tree.root).find((n) => n.type === 'FRAME' && n.clipsContent && n.children?.some((c) => c.type === 'VECTOR'));

      expect(tree.snaps).toEqual([]);
      expect(clip?.absoluteBoundingBox).toEqual({ x: 0, y: 0, width: 20, height: 40 });
    } finally {
      await browser.close();
    }
  }, 30_000);
});

const SHAPED = `<body style="margin:0"><svg width="0" height="0" style="position:absolute"><clipPath id="logo" clipPathUnits="objectBoundingBox"><path d="M0 0H1L0.5 1Z"/></clipPath></svg><div style="width:200px;height:120px;background:#146ef5;clip-path:url(#logo)"></div></body>`;

describe.runIf(process.env.CHROMIUM_PATH)('a block cut by an svg clip path', () => {
  it('comes in as a picture of its shape, not an empty one (webflow: the footer logo vanished)', async () => {
    const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, headless: 'shell' });
    try {
      const tab = await localBrowser(() => browser.newPage())();
      await tab.goto(`data:text/html,${encodeURIComponent(SHAPED)}`);
      const tree = (await tab.tree()) as PageTree;
      const all = (n: RestNode): RestNode[] => [n, ...(n.children ?? []).flatMap(all)];
      const picture = all(tree.root).flatMap((n) => n.fills ?? []).find((f) => f.imageRef?.startsWith('data:'))!;
      const { data, info } = await sharp(Buffer.from(picture.imageRef!.split(',')[1], 'base64')).raw().toBuffer({ resolveWithObject: true });
      const at = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3];

      expect(at(100, 10)).toBe(255);
      expect(at(5, 110)).toBe(0);
    } finally {
      await browser.close();
    }
  }, 30_000);
});

const PAINTED = `<body style="margin:0;background:#fff"><canvas id="cv" width="100" height="100" style="display:block;width:100px;height:100px"></canvas><script>const c = document.getElementById('cv').getContext('2d'); c.fillStyle = '#00f'; c.fillRect(0, 0, 100, 100);</script></body>`;

describe.runIf(process.env.CHROMIUM_PATH)('a canvas that keeps drawing after it was read', () => {
  it('stays on the picture the import took, so the page and the import show the same frame (vercel: the hero glow moved between the two)', async () => {
    const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, headless: 'shell' });
    try {
      let page: Page | null = null;
      const tab = await localBrowser(async () => (page = await browser.newPage()))();
      await tab.goto(`data:text/html,${encodeURIComponent(PAINTED)}`);
      await tab.tree();
      await page!.evaluate(() => {
        const canvas = document.getElementById('cv') as HTMLCanvasElement | null;
        const c = canvas?.getContext('2d');
        if (c) {
          c.fillStyle = '#f00';
          c.fillRect(0, 0, 100, 100);
        }
      });
      const { data } = await sharp(Buffer.from(await page!.screenshot({ type: 'png', clip: { x: 50, y: 50, width: 1, height: 1 } }))).raw().toBuffer({ resolveWithObject: true });

      expect([data[0], data[1], data[2]]).toEqual([0, 0, 255]);
    } finally {
      await browser.close();
    }
  }, 30_000);
});
