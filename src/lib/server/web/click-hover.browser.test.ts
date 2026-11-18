import puppeteer from 'puppeteer-core';
import { describe, expect, it } from 'vitest';
import { localBrowser } from './browser';

const BANNER = `<!doctype html><html><head><style>body{margin:0}.row{height:2000px;background:white}.row:hover{background:red}#ok{position:fixed;left:0;bottom:0;width:100%;height:120px}</style></head><body><div class="row"></div><button id="ok" onclick="this.remove()">Accept</button></body></html>`;

describe.runIf(process.env.CHROMIUM_PATH)('a cookie banner clicked away during an import', () => {
  it('leaves nothing under the pointer hovered (traidue: the glossary row under the banner came in highlighted)', async () => {
    const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, headless: 'shell' });
    try {
      const tab = await localBrowser(() => browser.newPage())();
      await tab.viewport(1280);
      await tab.goto(`data:text/html,${encodeURIComponent(BANNER)}`);
      await tab.click({ selector: '#ok' });
      const pages = await browser.pages();

      expect(await pages[pages.length - 1].evaluate(() => getComputedStyle(document.querySelector('.row')!).backgroundColor)).toBe('rgb(255, 255, 255)');
    } finally {
      await browser.close();
    }
  }, 30_000);
});
