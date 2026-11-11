import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, chromium } from '@playwright/test';
import { LANDINGS_FIXTURE_CENTRE, LANDINGS_FIXTURE_PLACE } from '../../scripts/perf/landings-fixture.mjs';
import { playWheel, zoomPath } from '../../scripts/perf/gestures';

const OUT = process.env.BENCH_OUT ?? 'perf-results';
const VIEWPORT = { width: 1440, height: 900 };
const CENTRE = { x: 720, y: 450 };
const Z0 = Number(process.env.PROBE_Z0 ?? 0.4);
const Z1 = Number(process.env.PROBE_Z1 ?? 1.6);
const LEG_MS = Number(process.env.PROBE_LEG_MS ?? 500);
const VIEW_KEY = `feega:viewport:00000000-0000-4000-8000-00000000f002:${LANDINGS_FIXTURE_PLACE.canvasId}`;

test('blank probe', async ({ baseURL }) => {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, recordVideo: { dir: OUT, size: VIEWPORT } });
  const page = await context.newPage();
  const view = { x: CENTRE.x - LANDINGS_FIXTURE_CENTRE.x * Z0, y: CENTRE.y - LANDINGS_FIXTURE_CENTRE.y * Z0, zoom: Z0 };
  await page.addInitScript(({ key, view }) => localStorage.setItem(key, JSON.stringify(view)), { key: VIEW_KEY, view });
  const cdp = await context.newCDPSession(page);
  await page.goto(`${baseURL}/p/${LANDINGS_FIXTURE_PLACE.projectId}/c/${LANDINGS_FIXTURE_PLACE.canvasId}${process.env.BENCH_QUERY ?? ''}`, { waitUntil: 'commit' });
  await page.locator('[data-canvas-surface]').first().waitFor({ timeout: 120_000 });
  await page.waitForTimeout(12_000);
  let n = 0;
  cdp.on('Page.screencastFrame', async ({ data, sessionId }) => {
    writeFileSync(join(OUT, `f${String(n++).padStart(4, '0')}.jpg`), Buffer.from(data, 'base64'));
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 1 });
  await playWheel(cdp, zoomPath({ from: Z0, anchor: CENTRE, legs: [{ to: Z1, ms: LEG_MS }, { to: Z0, ms: LEG_MS }, { to: Z1 * 2, ms: LEG_MS }, { to: Z0, ms: LEG_MS }] }));
  await page.waitForTimeout(3000);
  await cdp.send('Page.stopScreencast');
  await context.close();
  await browser.close();
});
