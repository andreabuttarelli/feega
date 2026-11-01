import puppeteer from 'puppeteer-core';
import { describe, expect, it } from 'vitest';
import type { RestNode } from '$lib/server/figma/rest-message';
import { TREE_LIMITS, treeScript, type PageTree } from './page-tree';

const PAGE = `<style>
  .buy { width: 120px; height: 40px; background: #0066ff; color: #fff; border: 0; transition: background-color 150ms ease-out; }
  .buy:hover { background: #003399; }
  .card { width: 200px; height: 80px; background: #eee; margin-top: 20px; }
  .card:hover .title { color: red; }
  @media (max-width: 10px) { .buy:hover { background: #ff0000; } }
</style>
<body style="margin:0;font:16px sans-serif"><button class="buy">Buy now</button><div class="card"><span class="title">Plain</span></div></body>`;

const all = (n: RestNode): RestNode[] => [n, ...(n.children ?? []).flatMap(all)];

describe.runIf(process.env.CHROMIUM_PATH)('hover styles of a page in a real browser', () => {
  it('a button that changes on hover carries the hovered look and its transition; a parent that only recolours a child does not', async () => {
    const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, headless: 'shell' });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 400, height: 300 });
      await page.setContent(PAGE);
      const tree = (await page.evaluate(treeScript(TREE_LIMITS))) as PageTree;
      const hovered = all(tree.root).filter((n) => n.hover);

      expect(hovered.map((n) => n.hover)).toEqual([{ fill: 'rgb(0, 51, 153)', durationMs: 150, easing: 'ease-out' }]);
      expect(await page.evaluate(() => getComputedStyle(document.querySelector('.buy')!).backgroundColor)).toBe('rgb(0, 102, 255)');
    } finally {
      await browser.close();
    }
  }, 30_000);
});
