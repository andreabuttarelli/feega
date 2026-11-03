import puppeteer from 'puppeteer-core';
import { describe, expect, it } from 'vitest';
import { localBrowser } from './browser';

const TALL = `<!doctype html><html><head><style>::-webkit-scrollbar{width:15px;background:#eee}</style></head><body style="margin:0"><div style="height:5000px">Tall</div></body></html>`;

describe.runIf(process.env.CHROMIUM_PATH)('a page opened for an import', () => {
  it.each([1280, 768, 390])('lays out at the full %i px of its viewport, with no scrollbar taking 15 px', async (width) => {
    const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, headless: 'shell', ignoreDefaultArgs: ['--hide-scrollbars'] });
    try {
      const tab = await localBrowser(() => browser.newPage())();
      await tab.viewport(width);
      await tab.goto(`data:text/html,${encodeURIComponent(TALL)}`);
      const pages = await browser.pages();

      expect(await pages[pages.length - 1].evaluate(() => document.documentElement.clientWidth)).toBe(width);
    } finally {
      await browser.close();
    }
  }, 30_000);
});
