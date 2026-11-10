import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { test, chromium } from '@playwright/test';
import { LANDINGS_FIXTURE_CENTRE, LANDINGS_FIXTURE_PLACE } from '../../scripts/perf/landings-fixture.mjs';

const VIEWPORT = { width: 1440, height: 900 };
const VIEW_KEY = `feega:viewport:00000000-0000-4000-8000-00000000f002:${LANDINGS_FIXTURE_PLACE.canvasId}`;
const ZOOMS = [0.12, 0.5, 1.5, 4];
const SIDES = [2, 2, 3, 4];
const OUT = `${process.env.HOME}/Documents/feega-videos/perf/mipprobe/batchcheck`;

async function diff(a: Buffer, b: Buffer) {
  const [x, y] = await Promise.all([a, b].map((p) => sharp(p).raw().toBuffer()));
  let off = 0;
  for (let i = 0; i < x.length; i += 4) {
    const d = Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2]));
    if (d > 8) off++;
  }
  return off / (x.length / 4);
}

test('larger tile batches draw the same tiles', async ({ baseURL }) => {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  for (const zoom of ZOOMS) {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, serviceWorkers: 'block' });
    const page = await context.newPage();
    const view = { x: VIEWPORT.width / 2 - LANDINGS_FIXTURE_CENTRE.x * zoom, y: VIEWPORT.height / 2 - LANDINGS_FIXTURE_CENTRE.y * zoom, zoom };
    await page.addInitScript(({ key, view }) => localStorage.setItem(key, JSON.stringify(view)), { key: VIEW_KEY, view });
    await page.goto(`${baseURL}/p/${LANDINGS_FIXTURE_PLACE.projectId}/c/${LANDINGS_FIXTURE_PLACE.canvasId}?coreTiles=1`, { waitUntil: 'commit' });
    await page.locator('[data-canvas-surface]').first().waitFor({ timeout: 120_000 });
    await page.waitForTimeout(15_000);
    const shots: Buffer[] = [];
    for (const [i, side] of SIDES.entries()) {
      await page.evaluate((side) => (globalThis as unknown as { __coreProbe: { probe_present: (s: number) => void } }).__coreProbe.probe_present(BigInt(side) as unknown as number), side);
      await page.waitForTimeout(500);
      const shot = await page.screenshot();
      shots.push(shot);
      await sharp(shot).toFile(`${OUT}/z${zoom}-s${side}-${i}.png`);
    }
    console.log(JSON.stringify({ zoom, control: await diff(shots[0], shots[1]), side3: await diff(shots[0], shots[2]), side4: await diff(shots[0], shots[3]) }));
    await context.close();
  }
  await browser.close();
});
