import puppeteer, { type Page } from 'puppeteer-core';
import { describe, expect, it } from 'vitest';
import type { RestNode } from '$lib/server/figma/rest-message';
import { localBrowser } from '$lib/server/web/browser';
import type { PageTree } from './page-tree';
import { inViewSampled, revealPage, RevealMode } from './page-reveal';
import { pagePrepared, PLAIN_PLANNER } from './import-url';

const SETTLE_MS = 200;

const PAGE = `<!doctype html><html><head><style>
@keyframes slide{to{transform:translateX(-600px)}}
@keyframes fade{from{opacity:0.05}to{opacity:1}}
body{margin:0;font:16px sans-serif}
</style></head><body>
<div style="overflow:hidden;width:600px;height:60px"><div style="display:flex;width:1200px;animation:slide 4s linear infinite"><div style="width:600px">slide one</div><div style="width:600px">slide two</div></div></div>
<div id="looped" style="width:50px;height:50px;background:#0a0">looped</div>
<div style="height:1600px"></div>
<div style="height:200px;background:#c00;animation:fade linear both;animation-timeline:view();animation-range:entry 0% cover 40%">viewed</div>
<div style="height:1200px"></div>
<div id="scripted" style="height:200px;background:#00c">scripted</div>
<div style="height:1600px"></div>
<script>
const raf = window.requestAnimationFrame.bind(window);
const looped = document.getElementById('looped');
const loop = (t) => { looped.style.transform = 'translateX(' + Math.round(t / 4) % 400 + 'px)'; raf(loop); };
raf(loop);
matchMedia('(orientation: portrait)').addEventListener('change', () => { looped.style.translate = '999px'; });
const scripted = document.getElementById('scripted');
const place = () => { const r = scripted.getBoundingClientRect(); scripted.style.opacity = String(Math.min(1, Math.max(0.05, ((innerHeight - r.top) / innerHeight) * 2))); };
addEventListener('scroll', place);
place();
window.lateTimer = () => setTimeout(() => { looped.style.translate = '555px'; }, 300);
const shadowBanner = (text, parent) => {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;top:0;right:0';
  const root = host.attachShadow({ mode: 'closed' });
  parent.appendChild(host);
  return () => { root.innerHTML = '<style>' + '.rule{color:red}'.repeat(200) + '</style><div style="width:300px;padding:20px;background:#fff">' + text + ' <button>Reject all</button></div>'; };
};
shadowBanner('Your consent matters to us.', document.documentElement)();
window.lateBanner = () => {
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;bottom:0;left:0;width:300px;padding:20px;background:#fff';
  banner.innerHTML = 'We use cookies to improve your experience. <button>Accept all</button>';
  document.body.appendChild(banner);
  Promise.resolve().then(shadowBanner('Cookie choices, later.', document.body));
};
</script></body></html>`;

const all = (n: RestNode): RestNode[] => [n, ...(n.children ?? []).flatMap(all)];
const textOf = (tree: PageTree, text: string) => all(tree.root).find((n) => n.type === 'TEXT' && n.characters?.includes(text));
const frameWith = (tree: PageTree, text: string) => all(tree.root).find((n) => n.type === 'FRAME' && n.children?.some((c) => c.type === 'TEXT' && c.characters?.includes(text)));
const loopedAt = (page: Page) => page.evaluate(() => getComputedStyle(document.getElementById('looped')!).transform + getComputedStyle(document.getElementById('looped')!).translate);

describe.runIf(process.env.CHROMIUM_PATH)('a page frozen for import reads the same every time', () => {
  it('carousels at the first slide, scroll-driven blocks in view, late banners hidden, nothing moves after the freeze', async () => {
    const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, headless: 'shell' });
    try {
      let page: Page | null = null;
      const tab = await localBrowser(async () => (page = await browser.newPage()))();
      await pagePrepared(tab, new URL(`data:text/html,${encodeURIComponent(PAGE)}`), SETTLE_MS, PLAIN_PLANNER);
      await page!.evaluate(() => (window as unknown as { lateBanner: () => void }).lateBanner());
      await page!.evaluate(() => (window as unknown as { lateTimer: () => void }).lateTimer());
      const before = await loopedAt(page!);
      const tree = (await tab.tree()) as PageTree;
      await tab.reveal(RevealMode.Still);
      await page!.evaluate(() => window.scrollTo(0, 2_000));
      await page!.screenshot({ captureBeyondViewport: true, clip: { x: 0, y: 2_000, width: 1_280, height: 2_000 } });
      await new Promise((done) => setTimeout(done, 300));
      const after = await loopedAt(page!);
      const scripted = await page!.evaluate(() => getComputedStyle(document.getElementById('scripted')!).opacity);

      expect(textOf(tree, 'slide one')?.absoluteBoundingBox?.x).toBeCloseTo(0, 0);
      expect(frameWith(tree, 'viewed')?.opacity ?? 1).toBeGreaterThan(0.99);
      expect(frameWith(tree, 'scripted')?.opacity ?? 1).toBeGreaterThan(0.99);
      expect(textOf(tree, 'We use cookies')).toBeUndefined();
      expect(textOf(tree, 'Your consent')).toBeUndefined();
      expect(textOf(tree, 'Cookie choices')).toBeUndefined();
      expect(await page!.evaluate(() => [...document.documentElement.children].filter((d) => d.shadowRoot).map((d) => getComputedStyle(d).display))).toEqual(['none']);
      expect(after).toBe(before);
      expect(Number(scripted)).toBeGreaterThan(0.99);
    } finally {
      await browser.close();
    }
  }, 60_000);
});

const SAMPLED = `<body style="margin:0"><div style="height:1200px"></div><div id="card" style="height:400px;background:#000">card</div><div id="ticker" style="height:40px">ticker</div><div style="height:2000px"></div></body>`;

describe.runIf(process.env.CHROMIUM_PATH)('the state a block is frozen in', () => {
  it('is the most visible one it reached while in view, and nothing that moves on its own is pinned (framer: a card frozen halfway through its fade)', async () => {
    const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, headless: 'shell' });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 800, height: 800 });
      await page.setContent(SAMPLED);
      const at = async (y: number, opacity: string, ticker: string) => {
        await page.evaluate(
          (top, o, t) => {
            window.scrollTo(0, top);
            document.getElementById('card')!.style.opacity = o;
            document.getElementById('ticker')!.style.translate = t;
          },
          y,
          opacity,
          ticker
        );
        await page.evaluate(inViewSampled);
      };
      await at(0, '0', '0px');
      await at(0, '0', '10px');
      await at(700, '0.3', '20px');
      await at(1000, '0.3', '30px');
      await at(1300, '1', '40px');
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.getElementById('card')!.style.opacity = '0';
        document.getElementById('ticker')!.style.translate = '50px';
      });
      await page.evaluate(revealPage, RevealMode.Still);
      const [card, ticker] = await page.evaluate(() => [getComputedStyle(document.getElementById('card')!).opacity, getComputedStyle(document.getElementById('ticker')!).translate]);

      expect(card).toBe('1');
      expect(ticker).toBe('50px');
    } finally {
      await browser.close();
    }
  }, 30_000);
});
