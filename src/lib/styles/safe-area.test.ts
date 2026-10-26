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

describe('desktop window without a title bar', () => {
  const WINDOW_CSS = read('src/lib/styles/desktop-window.css');

  async function style(window: string, markup: string, probe: string, pseudo?: string): Promise<string> {
    const page = await browser.newPage();
    await page.setContent(`<html data-window="${window}"><style>${SAFE_AREA_CSS}${WINDOW_CSS}</style>${markup}</html>`);
    const value = await page.locator('#probe').evaluate(
      (el, [prop, pseudoEl]) => getComputedStyle(el, pseudoEl ?? null).getPropertyValue(prop),
      [probe, pseudo] as const
    );
    await page.close();
    return value;
  }

  it('starts the UI at the top, like the browser', async () => {
    expect(await style('mac', '<div id="probe" class="safe-shell"></div>', 'padding-top')).toBe('0px');
  });

  it('drags the window from the canvas bar, clear of the traffic lights', async () => {
    const bar = '<header id="probe" class="canvas-topbar"><button>x</button></header>';
    expect(await style('mac', bar, 'app-region')).toBe('drag');
    expect(await style('mac', bar, 'padding-left')).toBe('80px');
    expect(await style('overlay', bar, 'padding-right')).toBe('140px');
  });

  it('keeps controls inside a drag area clickable', async () => {
    expect(await style('mac', '<header class="canvas-topbar"><button id="probe">x</button></header>', 'app-region')).toBe('no-drag');
  });

  it('gives the sidebar a draggable top under the traffic lights', async () => {
    const side = '<nav id="probe" class="app-sidebar"></nav>';
    expect(await style('mac', side, 'app-region', '::before')).toBe('drag');
    expect(await style('mac', side, 'height', '::before')).toBe('28px');
  });

  it('marks only the Electron shell, by platform, never the mobile one or the browser', async () => {
    const marker = read('src/app.html').match(/<script>(\(function\(u\)[^<]*data-window[^<]*)<\/script>/)![1];
    const shell = async (userAgent: string) => {
      const context = await browser.newContext({ userAgent });
      const page = await context.newPage();
      await page.setContent(`<script>${marker}</script>`);
      const value = await page.evaluate(() => document.documentElement.dataset.window ?? 'browser');
      await context.close();
      return value;
    };
    expect(await shell('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140 Electron/38.2.0 FeegaNative/0.1.0')).toBe('mac');
    expect(await shell('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140 Electron/38.2.0 FeegaNative/0.1.0')).toBe('overlay');
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
