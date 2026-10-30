import puppeteer from 'puppeteer-core';
import { describe, expect, it } from 'vitest';
import type { RestNode } from '$lib/server/figma/rest-message';
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
