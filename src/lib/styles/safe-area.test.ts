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

describe('layouts that render under viewport-fit=cover', () => {
  it('ship the safe-area rules app-wide', () => {
    expect(read('src/app.css')).toContain("@import './lib/styles/safe-area.css'");
  });

  it('wrap the project shell and the app shell', () => {
    expect(read('src/routes/p/[projectId]/+layout.svelte')).toMatch(/class="project-shell safe-shell[^"]*"[^>]*data-safe=/);
    expect(read('src/lib/components/app/AppShell.svelte')).toContain('class="app-shell safe-shell ui-app"');
  });
});
