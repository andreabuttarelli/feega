import { writeFileSync } from 'node:fs';
import { test, chromium } from '@playwright/test';
import { LANDINGS_FIXTURE_CENTRE, LANDINGS_FIXTURE_PLACE } from '../../scripts/perf/landings-fixture.mjs';

const VIEWPORT = { width: 1440, height: 900 };
const LOCAL_USER_ID = '00000000-0000-4000-8000-00000000f002';
const VIEW_KEY = `feega:viewport:${LOCAL_USER_ID}:${LANDINGS_FIXTURE_PLACE.canvasId}`;
const ZOOMS = process.env.PROBE_PROFILE ? [1.5] : [0.12, 0.5, 1.5];
const DSTEPS = [0, 4];
const CPU = Number(process.env.BENCH_CPU ?? 1);
const IDLE_MS = 12_000;

test('raster cost per pyramid level', async ({ baseURL }) => {
  const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  const rows: unknown[] = [];
  for (const zoom of ZOOMS) {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, serviceWorkers: 'block' });
    const page = await context.newPage();
    const view = { x: VIEWPORT.width / 2 - LANDINGS_FIXTURE_CENTRE.x * zoom, y: VIEWPORT.height / 2 - LANDINGS_FIXTURE_CENTRE.y * zoom, zoom };
    await page.addInitScript(({ key, view }) => localStorage.setItem(key, JSON.stringify(view)), { key: VIEW_KEY, view });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await page.goto(`${baseURL}/p/${LANDINGS_FIXTURE_PLACE.projectId}/c/${LANDINGS_FIXTURE_PLACE.canvasId}?coreTiles=1`, { waitUntil: 'commit' });
    await page.locator('[data-canvas-surface]').first().waitFor({ timeout: 120_000 });
    await page.waitForTimeout(IDLE_MS);
    for (const d of DSTEPS) {
      const runs: unknown[] = [];
      if (process.env.PROBE_PROFILE && d === 4) {
        await cdp.send('Profiler.enable');
        await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
        await cdp.send('Profiler.start');
      }
      for (let i = 0; i < 2; i++) {
        runs.push(await page.evaluate(async (d) => JSON.parse(await (globalThis as unknown as { __coreProbe: { probe_raster: (d: number) => Promise<string> } }).__coreProbe.probe_raster(d)), d));
      }
      if (process.env.PROBE_PROFILE && d === 4) {
        const { profile } = await cdp.send('Profiler.stop');
        writeFileSync('perf-results/mipprobe.cpuprofile', JSON.stringify(profile));
      }
      rows.push({ zoom, d, runs });
      console.log(JSON.stringify({ zoom, d, runs }));
    }
    await context.close();
  }
  writeFileSync(`perf-results/mipprobe-${CPU}x.json`, JSON.stringify(rows, null, 1));
  await browser.close();
});
