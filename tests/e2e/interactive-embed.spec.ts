import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { expect, test, type Page } from '@playwright/test';
import { LUMEN_PATH, serveLumen } from './fixtures/interactive-routes';

enum Engine {
  Gpu = 'gpu',
  Hyperframes = 'hyperframes'
}

const ENGINE = (process.env.HERO_ENGINE as Engine | undefined) ?? Engine.Gpu;
const LUMEN_DIR = process.env.LUMEN_DIR ?? '';
const HERO_LINK = 'https://docs.feega.app/motion/interactive-embeds/';
const SHOTS = process.env.SHOTS_DIR;
const SETTLE_MS = 900;
const BOOT_MS = 6000;
const VIEW = { width: 1600, height: 900 };
const FLOOR = 1.2;
const TRACK_ROW = 0.955;
const LINK_AT = { x: 580, y: 711 };
const CTA_AT = { x: 0.1725 * VIEW.width, y: 0.79 * VIEW.height };
const SCROLL_PX = 450;
const PLAYBACK = process.env.HERO_PLAYBACK ?? 'autoplay';
const PULSE_BOX = { left: 0, top: 560, width: 700, height: 340 };

const LOOPBACK_FLAGS = ['--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests'];

test.use({ viewport: VIEW, launchOptions: { args: ENGINE === Engine.Hyperframes ? LOOPBACK_FLAGS : [] } });

async function pixels(page: Page): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(await page.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

const meanDiff = (a: Buffer, b: Buffer) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / a.length;

async function region(page: Page, box: { left: number; top: number; width: number; height: number }): Promise<Buffer> {
  return sharp(await page.screenshot()).extract(box).removeAlpha().raw().toBuffer();
}

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: join(SHOTS, `${ENGINE}-${name}.png`) });
  }
}

async function openLumen(page: Page): Promise<void> {
  const origin = new URL(page.url() === 'about:blank' ? test.info().project.use.baseURL! : page.url()).origin;
  await page.addInitScript(() => {
    const w = window as unknown as { __opened: string[]; open: (url?: string | URL) => null };
    w.__opened = [];
    w.open = (url) => {
      w.__opened.push(String(url));
      return null;
    };
  });
  await serveLumen(page, origin, LUMEN_DIR);
  await page.goto(`${origin}${LUMEN_PATH}`);
  await page.waitForSelector('feega-motion iframe');
  await page.waitForTimeout(BOOT_MS);
}

const heroFrame = (page: Page) => page.frames().find((f) => f.url().includes('/e/lumen-hero'))!;

test.describe(`interactive hero on ${ENGINE}`, () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!LUMEN_DIR, 'build the page first: npx vite-node tests/e2e/fixtures/build-lumen.ts <dir> <origin>, then set LUMEN_DIR=<dir>');

  test('draws the hero on the expected engine', async ({ page }) => {
    await openLumen(page);
    await shot(page, '1-idle');
    const frame = heroFrame(page);

    expect(await frame.locator('feega-gpu-player').count()).toBe(ENGINE === Engine.Gpu ? 1 : 0);
    expect(await frame.locator('hyperframes-player').count()).toBe(ENGINE === Engine.Hyperframes ? 1 : 0);
    const { data } = await pixels(page);
    const lit = Array.from({ length: data.length / 3 }, (_, i) => data[i * 3] + data[i * 3 + 1] + data[i * 3 + 2]).filter((v) => v > 250).length;
    expect(lit).toBeGreaterThan(2000);
  });

  test('hover: the picture follows the pointer', async ({ page }) => {
    await openLumen(page);
    await page.mouse.move(300, 250, { steps: 8 });
    await page.waitForTimeout(SETTLE_MS);
    const left = await pixels(page);
    await shot(page, '2-hover-left');
    await page.mouse.move(1350, 650, { steps: 12 });
    await page.waitForTimeout(SETTLE_MS);
    const right = await pixels(page);
    await shot(page, '3-hover-right');

    expect(meanDiff(left.data, right.data)).toBeGreaterThan(FLOOR);
  });

  test('click: pressing pulses the button and the glow, releasing lets go', async ({ page }) => {
    await openLumen(page);
    await page.mouse.move(CTA_AT.x, CTA_AT.y, { steps: 10 });
    await page.waitForTimeout(SETTLE_MS);
    const resting = await region(page, PULSE_BOX);
    await page.mouse.down();
    await page.waitForTimeout(SETTLE_MS);
    const pressed = await region(page, PULSE_BOX);
    await shot(page, '4-pressed');
    await page.mouse.up();
    await page.waitForTimeout(SETTLE_MS * 2);
    const released = await region(page, PULSE_BOX);

    expect(meanDiff(resting, pressed)).toBeGreaterThan(FLOOR);
    expect(meanDiff(resting, released)).toBeLessThan(meanDiff(resting, pressed) / 2);
  });

  test('scroll: the page scroll moves the picture and fills the progress bar', async ({ page }) => {
    await openLumen(page);
    const before = await pixels(page);
    await page.mouse.move(VIEW.width / 2, 200);
    await page.mouse.wheel(0, SCROLL_PX);
    await page.waitForTimeout(SETTLE_MS * 2);
    const after = await pixels(page);
    await shot(page, '5-scrolled');
    const pinned = PLAYBACK === 'scrub';
    const y = Math.round(TRACK_ROW * VIEW.height) - (pinned ? 0 : SCROLL_PX);
    const row = y * after.width * 3;
    const at = (x: number) => after.data.subarray(row + Math.round(x * after.width) * 3, row + Math.round(x * after.width) * 3 + 3);

    expect(meanDiff(before.data, after.data)).toBeGreaterThan(FLOOR);
    expect(at(0.15)[2]).toBeGreaterThan(at(0.92)[2] + 40);
  });

  test('link: the cursor turns into a pointer and a click opens it', async ({ page }) => {
    test.skip(ENGINE === Engine.Hyperframes, 'the HTML player never opened links of an interactive video');
    await openLumen(page);
    await page.mouse.move(LINK_AT.x, LINK_AT.y, { steps: 6 });
    await page.waitForTimeout(SETTLE_MS);
    const cursor = await heroFrame(page).evaluate(() => document.getElementById('pad')!.style.cursor);
    await page.mouse.click(LINK_AT.x, LINK_AT.y);
    const urls = await heroFrame(page).evaluate(() => (window as unknown as { __opened: string[] }).__opened);
    await shot(page, '6-link');

    expect(cursor).toBe('pointer');
    expect(urls).toEqual([HERO_LINK]);
  });
});
