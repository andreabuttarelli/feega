import puppeteer, { type Page } from 'puppeteer-core';
import { describe, expect, it } from 'vitest';
import type { RestNode } from '$lib/server/figma/rest-message';
import { localBrowser } from '$lib/server/web/browser';
import type { PageTree } from './page-tree';
import { pagePrepared, PLAIN_PLANNER } from './import-url';

const SETTLE_MS = 200;
const HYDRATION_MS = 2_500;
const PIXEL = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="#c60"/></svg>');

const WIKI = `<!doctype html><html><head><style>
body{margin:0;font:16px sans-serif}
.page{display:flex;gap:40px;padding:40px}
.toc{display:none;width:200px}
@media (min-width:1024px){.toc{display:block}}
</style></head><body>
<div class="page"><div id="side"></div><article>
<h1>Adolescenti</h1><h2 id="a">La scoperta</h2><p>testo</p>
<div style="height:2400px"></div>
<img id="late" loading="lazy" width="600" height="300" alt="">
<h2 id="b">La scuola</h2><p>testo</p>
</article></div>
<script>
setTimeout(() => {
  const nav = document.createElement('nav');
  nav.className = 'toc';
  nav.innerHTML = '<p>Indice</p>' + [...document.querySelectorAll('article h2')].map((h) => '<a href="#' + h.id + '">' + h.textContent + '</a>').join('');
  document.getElementById('side').appendChild(nav);
}, ${HYDRATION_MS});
document.getElementById('late').src = '${PIXEL}';
</script></body></html>`;

const all = (n: RestNode): RestNode[] => [n, ...(n.children ?? []).flatMap(all)];
const texts = (tree: PageTree) => all(tree.root).flatMap((n) => (n.type === 'TEXT' ? [n.characters ?? ''] : []));

describe.runIf(process.env.CHROMIUM_PATH)('a page captured for import', () => {
  it('waits for a sidebar rendered after hydration, and for lazy images', async () => {
    const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, headless: 'shell' });
    try {
      let page: Page | null = null;
      const tab = await localBrowser(async () => (page = await browser.newPage()))();
      await pagePrepared(tab, new URL(`data:text/html,${encodeURIComponent(WIKI)}`), SETTLE_MS, PLAIN_PLANNER);
      const tree = (await tab.tree()) as PageTree;

      expect(texts(tree)).toEqual(expect.arrayContaining(['Indice', 'La scoperta', 'La scuola']));
      expect(await page!.evaluate(() => (document.getElementById('late') as HTMLImageElement).complete && (document.getElementById('late') as HTMLImageElement).naturalWidth > 0)).toBe(true);
    } finally {
      await browser.close();
    }
  }, 60_000);
});
