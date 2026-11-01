import puppeteer from 'puppeteer-core';
import { describe, expect, it } from 'vitest';
import type { RestNode } from '$lib/server/figma/rest-message';
import { TREE_LIMITS, treeScript, type PageTree } from './page-tree';
import { PatternKind } from './page-patterns';

const PAGE = `<style>#tabs [role=tab]:focus { outline: 3px solid rgb(255, 0, 0); }</style><body style="margin:0;font:16px sans-serif">
<details style="width:400px;border-bottom:1px solid #ccc"><summary style="padding:8px">Is it free?</summary><p style="margin:0;padding:8px">Yes, the open source app is free.</p></details>
<div id="tabs" style="width:400px;margin-top:24px">
  <div role="tablist" style="display:flex;gap:8px">
    <button role="tab" aria-selected="true" aria-controls="p1" style="padding:6px">npm</button>
    <button role="tab" aria-selected="false" aria-controls="p2" style="padding:6px">pnpm</button>
  </div>
  <div role="tabpanel" id="p1" style="padding:8px;background:#eee">npm install feega</div>
  <div role="tabpanel" id="p2" hidden style="padding:8px;background:#eee">pnpm add feega</div>
</div>
<div id="dead" style="width:400px;margin-top:24px">
  <div role="tablist"><button role="tab" aria-selected="true" aria-controls="d1">One</button><button role="tab" aria-selected="false" aria-controls="d2">Two</button></div>
  <div role="tabpanel" id="d1">First</div><div role="tabpanel" id="d2" hidden>Second</div>
</div>
<button role="switch" aria-checked="false" id="dark" style="margin-top:24px;width:60px;height:30px;background:#999;border:0">Dark</button>
<script>
  const tabs = [...document.querySelectorAll('#tabs [role=tab]')];
  tabs.forEach((tab) => tab.addEventListener('click', () => {
    tabs.forEach((t) => {
      t.setAttribute('aria-selected', String(t === tab));
      tab.focus();
      document.getElementById(t.getAttribute('aria-controls')).hidden = t !== tab;
    });
  }));
  const dark = document.getElementById('dark');
  dark.addEventListener('click', () => {
    const on = dark.getAttribute('aria-checked') !== 'true';
    dark.setAttribute('aria-checked', String(on));
    dark.style.background = on ? '#06f' : '#999';
  });
</script>
</body>`;

const all = (n: RestNode): RestNode[] => [n, ...(n.children ?? []).flatMap(all)];
const textsOf = (n: RestNode) => all(n).filter((d) => d.type === 'TEXT' && !d.collapsed).map((d) => d.characters?.trim());

describe.runIf(process.env.CHROMIUM_PATH)('dynamic parts of a page in a real browser', () => {
  it('an accordion, tabs and a switch come back with every state they can show, tabs that do not answer a click are left alone, and the page is as it was', async () => {
    const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, headless: 'shell' });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 600, height: 400 });
      await page.setContent(PAGE);
      const tree = (await page.evaluate(treeScript(TREE_LIMITS))) as PageTree;
      const patterns = tree.patterns ?? [];
      const of = (kind: PatternKind) => patterns.find((p) => p.kind === kind)!;

      expect(patterns.map((p) => [p.kind, p.prop, p.states])).toEqual([
        [PatternKind.Accordion, 'State', ['Closed', 'Open']],
        [PatternKind.Tabs, 'Tab', ['npm', 'pnpm']],
        [PatternKind.Toggle, 'State', ['Off', 'On']]
      ]);
      expect(textsOf(of(PatternKind.Accordion).variants[0].root)).toContain('Yes, the open source app is free.');
      expect(textsOf(of(PatternKind.Tabs).variants[0].root)).toContain('pnpm add feega');
      expect(JSON.stringify(of(PatternKind.Tabs).variants[0].root)).not.toContain('"r":1,"g":0,"b":0');
      expect(textsOf(tree.root)).not.toContain('pnpm add feega');
      expect(all(tree.root).filter((n) => n.go).map((n) => n.go)).toEqual(['Open', 'npm', 'pnpm', 'On']);
      expect(all(of(PatternKind.Accordion).variants[0].root).find((n) => n.go)?.go).toBe('Closed');
      expect(await page.evaluate(() => [document.querySelector('details')!.open, document.getElementById('p2')!.hidden, document.getElementById('dark')!.getAttribute('aria-checked')])).toEqual([false, true, 'false']);
    } finally {
      await browser.close();
    }
  }, 30_000);

  it('a menu link that would leave the page opens its menu without leaving; a button whose panel is the whole page away is not a part', async () => {
    const MENU = `<body style="margin:0;font:16px sans-serif"><nav style="width:300px"><button aria-expanded="false" aria-controls="far" id="f">Far</button><a href="https://example.com/products" aria-expanded="false" aria-controls="m" id="t">Products</a><ul id="m" hidden style="margin:0;padding:8px;background:#eee"><li>Canvas</li><li>Motion</li></ul></nav><div id="far" hidden>Far panel</div>
<script>const t = document.getElementById('t'); const f = document.getElementById('f'); f.addEventListener('click', () => { f.setAttribute('aria-expanded', 'true'); document.getElementById('far').hidden = false; }); t.addEventListener('click', () => { const open = t.getAttribute('aria-expanded') !== 'true'; t.setAttribute('aria-expanded', String(open)); document.getElementById('m').hidden = !open; });</script></body>`;
    const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, headless: 'shell' });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 600, height: 400 });
      await page.setContent(MENU);
      const tree = (await page.evaluate(treeScript(TREE_LIMITS))) as PageTree;

      expect(tree.patterns?.map((p) => [p.kind, p.states])).toEqual([[PatternKind.Disclosure, ['Closed', 'Open']]]);
      expect(textsOf(tree.patterns![0].variants[0].root)).toContain('Motion');
      expect(page.url()).toBe('about:blank');
    } finally {
      await browser.close();
    }
  }, 30_000);
});
