import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import { droppedConstruct, type PaintFacts } from '../component-library/dropped';
import type { Catalog } from './registry';

const LIBRARY = join(import.meta.dirname, '../../libraries/ruixen');
const CATALOG_FILE = join(LIBRARY, 'catalog.json');
const SETTLE_MS = 1_500;
const [base] = process.argv.slice(2);
if (!base || !process.env.CHROMIUM_PATH) {
  throw new Error('usage: CHROMIUM_PATH=… audit.ts <demo app url>');
}

const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, headless: 'shell' });
const index = await browser.newPage();
await index.goto(base, { waitUntil: 'networkidle0' });
const pages = await index.$$eval('a', (links) => links.map((a) => new URL(a.href).searchParams.get('s')!));
await index.close();

const facts = new Map<string, PaintFacts>();
for (const slug of pages) {
  const tab = await browser.newPage();
  await tab.setViewport({ width: 1280, height: 800 });
  await tab.goto(`${base}?s=${slug}`, { waitUntil: 'networkidle0', timeout: 60_000 });
  await new Promise((r) => setTimeout(r, SETTLE_MS));
  const found = await tab.$$eval('section[data-ruixen]', (sections) =>
    sections.map((section) => {
      const all = [...section.querySelectorAll('*')];
      const styles = all.map((el) => getComputedStyle(el));
      return {
        name: (section as HTMLElement).dataset.ruixen!,
        transforms: styles.map((s) => s.transform).filter((t) => t !== 'none'),
        masks: styles.map((s) => s.maskImage || s.webkitMaskImage).filter((m) => m && m !== 'none'),
        canvases: all.filter((el) => el.tagName === 'CANVAS' && el.getBoundingClientRect().width * el.getBoundingClientRect().height > 0).length
      };
    })
  );
  found.forEach(({ name, ...f }) => facts.set(name, f));
  await tab.close();
}
await browser.close();

const catalog = JSON.parse(readFileSync(CATALOG_FILE, 'utf8')) as Catalog;
const dropped = catalog.items.flatMap((item) => {
  const reason = facts.has(item.name) ? droppedConstruct(facts.get(item.name)!) : null;
  return reason ? [{ name: item.name, reason: `not imported: ${reason}` }] : [];
});
const out = new Set(dropped.map((d) => d.name));
writeFileSync(CATALOG_FILE, `${JSON.stringify({ ...catalog, items: catalog.items.filter((i) => !out.has(i.name)), skipped: [...(catalog.skipped ?? []), ...dropped] }, null, 2)}\n`);
console.log(JSON.stringify(dropped, null, 2));
