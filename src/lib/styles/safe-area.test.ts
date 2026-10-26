import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

const SAFE_AREA_CSS = read('src/lib/styles/safe-area.css');
const INSETS = '--safe-top: 40px; --safe-right: 12px; --safe-bottom: 20px; --safe-left: 8px;';

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

async function padding(markup: string, insets = INSETS): Promise<string> {
  const page = await browser.newPage();
  await page.setContent(`<style>${SAFE_AREA_CSS} :root { ${insets} }</style>${markup}`);
  const value = await page.locator('#shell').evaluate((el) => getComputedStyle(el).padding);
  await page.close();
  return value;
}

describe('safe area shell', () => {
  it('keeps tablet and desktop chrome out of every inset', async () => {
    expect(await padding('<div id="shell" class="safe-shell"></div>')).toBe('40px 12px 20px 8px');
  });

  it('leaves top and bottom to the phone bars, which pad themselves', async () => {
    expect(await padding('<div id="shell" class="safe-shell" data-safe="sides"></div>')).toBe('0px 12px 0px 8px');
  });

  it('is zero outside a notched device', async () => {
    expect(await padding('<div id="shell" class="safe-shell"></div>', '')).toBe('0px');
  });
});

describe('desktop shell without a title bar', () => {
  async function desktop(probe: (page: import('playwright').Page) => Promise<string>): Promise<string> {
    const page = await browser.newPage();
    await page.setContent(`<html data-window="frameless"><style>${SAFE_AREA_CSS}</style><div id="shell" class="safe-shell"></div></html>`);
    const value = await probe(page);
    await page.close();
    return value;
  }

  it('keeps shell content below the drag strip', async () => {
    expect(await desktop((p) => p.locator('#shell').evaluate((el) => getComputedStyle(el).paddingTop))).toBe('28px');
  });

  it('draws a draggable strip across the top', async () => {
    const strip = await desktop((p) =>
      p.evaluate(() => {
        const s = getComputedStyle(document.body, '::before');
        return [s.position, s.top, s.height, s.getPropertyValue('app-region')].join(' ');
      })
    );
    expect(strip).toBe('fixed 0px 28px drag');
  });

  it('marks only the Electron shell, never the mobile one or the browser', async () => {
    const marker = read('src/app.html').match(/<script>(\(function\(u\)[^<]*data-window[^<]*)<\/script>/)![1];
    const shell = async (userAgent: string) => {
      const context = await browser.newContext({ userAgent });
      const page = await context.newPage();
      await page.setContent(`<script>${marker}</script>`);
      const value = await page.evaluate(() => document.documentElement.dataset.window ?? 'browser');
      await context.close();
      return value;
    };
    expect(await shell('Mozilla/5.0 Chrome/140 Electron/38.2.0 Safari/537.36 FeegaNative/0.1.0')).toBe('frameless');
    expect(await shell('Mozilla/5.0 (iPhone) AppleWebKit/605 FeegaNative/1.0')).toBe('browser');
    expect(await shell('Mozilla/5.0 Chrome/140 Safari/537.36')).toBe('browser');
  });
});

describe('layouts that render under viewport-fit=cover', () => {
  it('ship the safe-area rules app-wide', () => {
    expect(read('src/app.css')).toContain("@import './lib/styles/safe-area.css'");
  });

  it('wrap the project shell and the app shell', () => {
    expect(read('src/routes/p/[projectId]/+layout.svelte')).toMatch(/class="project-shell safe-shell[^"]*"[^>]*data-safe=/);
    expect(read('src/lib/components/app/AppShell.svelte')).toContain('class="app-shell safe-shell ui-app"');
  });
});
