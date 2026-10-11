import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium } from 'playwright';
import puppeteer, { type Browser } from 'puppeteer-core';
import { RAW_CAPTURE, vectorUi } from '$lib/motion/vector-ui/model';
import { localBrowser, vectorOfPage, type AppTab } from './browser';
import { FIDELITY_MIN } from './vector-capture';
import { uiFidelity } from './ui-fidelity';

const SIZE = { width: 1280, height: 800 };
const APP = `<!doctype html><html><body style="margin:0;background:#f9f9f9;font-family:Arial,sans-serif">
<aside style="position:absolute;left:0;top:0;width:220px;height:800px;background:#fff;border-right:1px solid #e5e5e5">
<a style="position:absolute;left:24px;top:24px;font-size:18px;color:#111">feega</a>
<a style="position:absolute;left:24px;top:80px;font-size:14px;color:#444">New video</a>
<a style="position:absolute;left:24px;top:112px;font-size:14px;color:#444">Motion editor</a></aside>
<h1 style="position:absolute;left:520px;top:180px;margin:0;font-size:56px;color:#111">make a video.</h1>
<input style="position:absolute;left:400px;top:300px;width:680px;height:56px;border:1px solid #ddd;background:#fff;font-size:16px;padding:0 16px;box-sizing:border-box" placeholder="Paste your website">
<button style="position:absolute;left:1036px;top:368px;width:44px;height:44px;border:0;border-radius:50%;background:#0099ff"></button>
<button style="position:absolute;left:600px;top:440px;height:32px;padding:0 14px;border:1px solid #ddd;background:#fff;font-size:13px">Product launch</button>
</body></html>`;

let browser: Browser;

const opened = async () => {
  const page = await browser.newPage();
  await page.setViewport(SIZE);
  return page;
};

beforeAll(async () => {
  browser = await puppeteer.launch({ executablePath: chromium.executablePath(), args: ['--no-sandbox'] });
});

afterAll(async () => {
  await browser?.close();
});

describe('SSIM of a rebuilt screen, in a real browser', () => {
  it('a page read as vector UI and painted again matches its own screenshot', async () => {
    const page = await opened();
    await page.setContent(APP);
    const shot = Buffer.from(await page.screenshot({ type: 'jpeg', quality: 85, clip: { x: 0, y: 0, ...SIZE } }));
    const ui = vectorUi(RAW_CAPTURE.parse(await vectorOfPage(page)));
    await page.close();

    const tab = (await localBrowser(opened)()) as AppTab;
    const score = await uiFidelity(tab, ui, shot);
    await tab.close();

    expect(score).toBeGreaterThan(FIDELITY_MIN);
  }, 60_000);

  it('scores a different screen below the bar', async () => {
    const page = await opened();
    await page.setContent(APP);
    const ui = vectorUi(RAW_CAPTURE.parse(await vectorOfPage(page)));
    await page.setContent('<body style="margin:0;background:repeating-linear-gradient(90deg,#000 0 20px,#fff 20px 40px)"></body>');
    const other = Buffer.from(await page.screenshot({ type: 'jpeg', clip: { x: 0, y: 0, ...SIZE } }));
    await page.close();

    const tab = (await localBrowser(opened)()) as AppTab;
    const score = await uiFidelity(tab, ui, other);
    await tab.close();

    expect(score).toBeLessThan(FIDELITY_MIN);
  }, 60_000);
});
