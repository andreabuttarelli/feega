import puppeteer from 'puppeteer-core';
import { describe, expect, it } from 'vitest';
import { localBrowser } from './browser';

const SCRAMBLED = `<!doctype html><html><body><h1 id="t">x</h1><script>
  const final = 'For coding agents';
  const started = Date.now();
  const tick = () => {
    const done = Date.now() - started > 1500;
    document.getElementById('t').textContent = done ? final : [...final].map(() => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');
    if (!done) setTimeout(tick, 40);
  };
  tick();
</script></body></html>`;

describe.runIf(process.env.CHROMIUM_PATH)('a page read for an import', () => {
  it('is settled only once its text stops changing, so a scramble effect is read finished (vercel: "lpgjvoding agents")', async () => {
    const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, headless: 'shell' });
    try {
      const tab = await localBrowser(() => browser.newPage())();
      await tab.goto(`data:text/html,${encodeURIComponent(SCRAMBLED)}`);
      await tab.settle(0);
      const pages = await browser.pages();

      expect(await pages[pages.length - 1].evaluate(() => document.getElementById('t')!.textContent)).toBe('For coding agents');
    } finally {
      await browser.close();
    }
  }, 30_000);
});
