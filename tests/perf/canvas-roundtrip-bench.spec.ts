import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, chromium, type CDPSession, type Page } from '@playwright/test';
import { LANDINGS_FIXTURE_CENTRE, LANDINGS_FIXTURE_PLACE } from '../../scripts/perf/landings-fixture.mjs';
import { Ease, playWheel, zoomPath, type Point } from '../../scripts/perf/gestures';

type Frame = { at: number; moving: boolean; tiles: number; stillBlocks: number; bakeMs: number; unsharp: number; heldBytes: number };
type Lap = { lap: number; tiles: number; stillBlocks: number; bakeMs: number; unsharpMs: number; heldMb: number };

const LAPS = Number(process.env.BENCH_LAPS ?? 3);
const LEG_MS = Number(process.env.BENCH_LEG_MS ?? 800);
const EASE = (process.env.BENCH_EASE ?? Ease.Flick) as Ease;
const OUT = process.env.BENCH_OUT ?? 'perf-results';
const CHANNEL = process.env.BENCH_CHANNEL;
const VIEWPORT = { width: 1440, height: 900 };
const CENTRE: Point = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };
const LOCAL_USER_ID = '00000000-0000-4000-8000-00000000f002';
const NEAR = 0.4;
const FAR = 4;
const OPEN_SETTLE_MS = 8000;
const IDLE_MS = 800;
const IDLE_GIVE_UP_MS = 20_000;
const POLL_MS = 100;
const MB = 1 << 20;
const VIEW_KEY = `feega:viewport:${LOCAL_USER_ID}:${LANDINGS_FIXTURE_PLACE.canvasId}`;
const START_VIEW = { x: CENTRE.x - LANDINGS_FIXTURE_CENTRE.x * NEAR, y: CENTRE.y - LANDINGS_FIXTURE_CENTRE.y * NEAR, zoom: NEAR };

const leg = (from: number, to: number) => zoomPath({ from, anchor: CENTRE, ease: EASE, legs: [{ to, ms: LEG_MS }] });

const frames = (page: Page) => page.evaluate(() => ((window as unknown as { __gpuCanvas?: { frames?: Frame[] } }).__gpuCanvas?.frames ?? []).slice());

async function idle(page: Page) {
  const started = Date.now();
  while (Date.now() - started < IDLE_GIVE_UP_MS) {
    await page.waitForTimeout(POLL_MS);
    const last = await page.evaluate(() => ((window as unknown as { __gpuCanvas?: { frames?: Frame[] } }).__gpuCanvas?.frames ?? []).at(-1)?.at ?? 0);
    const now = await page.evaluate(() => performance.now());
    if (now - last > IDLE_MS) {
      return;
    }
  }
}

function summary(lap: number, seen: Frame[]): Lap {
  const unsharpMs = seen.reduce((sum, f, i) => sum + (f.unsharp > 0 && i + 1 < seen.length ? seen[i + 1].at - f.at : 0), 0);
  return {
    lap,
    tiles: seen.reduce((s, f) => s + f.tiles, 0),
    stillBlocks: seen.reduce((s, f) => s + f.stillBlocks, 0),
    bakeMs: Math.round(seen.reduce((s, f) => s + f.bakeMs, 0)),
    unsharpMs: Math.round(unsharpMs),
    heldMb: Math.round(Math.max(0, ...seen.map((f) => f.heldBytes)) / MB)
  };
}

async function lap(page: Page, cdp: CDPSession, n: number): Promise<Lap> {
  const since = await page.evaluate(() => performance.now());
  for (const [from, to] of [[NEAR, FAR], [FAR, NEAR]]) {
    await playWheel(cdp, leg(from, to));
    await idle(page);
  }
  return summary(n, (await frames(page)).filter((f) => f.at > since));
}

test('zoom round trip: what each lap rasters again', async ({ baseURL }) => {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: CHANNEL, headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(({ key, view }) => localStorage.setItem(key, JSON.stringify(view)), { key: VIEW_KEY, view: START_VIEW });
  const cdp = await context.newCDPSession(page);
  await page.goto(`${baseURL}/p/${LANDINGS_FIXTURE_PLACE.projectId}/c/${LANDINGS_FIXTURE_PLACE.canvasId}`, { waitUntil: 'commit' });
  await page.locator('[data-canvas-surface]').first().waitFor({ timeout: 120_000 });
  await page.waitForTimeout(OPEN_SETTLE_MS);
  await idle(page);
  const laps: Lap[] = [];
  for (let i = 1; i <= LAPS; i++) {
    laps.push(await lap(page, cdp, i));
    console.log(`lap ${JSON.stringify(laps.at(-1))}`);
  }
  writeFileSync(join(OUT, 'roundtrip.json'), JSON.stringify({ legMs: LEG_MS, ease: EASE, laps }, null, 2));
  writeFileSync(join(OUT, 'roundtrip-end.png'), await page.screenshot());
  await browser.close();
  expect(laps.length).toBe(LAPS);
});
