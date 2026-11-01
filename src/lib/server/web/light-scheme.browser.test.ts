import puppeteer from 'puppeteer-core';
import { describe, expect, it } from 'vitest';
import { localBrowser } from './browser';

const THEMED = `<!doctype html><html><head><script>
  const dark = matchMedia('(prefers-color-scheme: dark)').matches || !matchMedia('(prefers-color-scheme: light)').matches;
  document.documentElement.className = dark ? 'dark' : 'light';
</script><style>:root{color-scheme:light dark}</style></head><body>Theme</body></html>`;

const DARK_FINGERPRINT = () => {
  const real = window.matchMedia.bind(window);
  window.matchMedia = (query: string) => {
    const said = real(query);
    const dark = /prefers-color-scheme:\s*dark/.test(query);
    const light = /prefers-color-scheme:\s*light/.test(query);
    return dark || light ? ({ matches: dark, media: query, onchange: null, addListener: () => undefined, removeListener: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => false } as MediaQueryList) : said;
  };
};

describe.runIf(process.env.CHROMIUM_PATH)('a page opened for an import', () => {
  it('reads as light even when the browser fingerprint answers dark to its scripts (vercel.com came back dark in some runs)', async () => {
    const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, headless: 'shell' });
    try {
      const open = localBrowser(async () => {
        const page = await browser.newPage();
        await page.evaluateOnNewDocument(DARK_FINGERPRINT);
        return page;
      });
      const tab = await open();
      await tab.goto(`data:text/html,${encodeURIComponent(THEMED)}`);
      const pages = await browser.pages();
      const page = pages[pages.length - 1];

      expect(await page.evaluate(() => document.documentElement.className)).toBe('light');
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light');
    } finally {
      await browser.close();
    }
  }, 30_000);
});
