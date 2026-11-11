import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, chromium, type Browser, type CDPSession, type Page } from '@playwright/test';
import { instrument, measure, wheelZoom, type CoreWork } from '../e2e/fixtures/frame-sweeps';
import { ZOOM_FIXTURE_CENTRE, ZOOM_FIXTURE_PLACE } from '../../scripts/perf/zoom-fixture.mjs';
import { median } from '../../scripts/perf/bench-stats.mjs';

type BenchRun = { fps: number; p95: number; p99: number; over11: number; worst: number; frames: number; cpuMs: number; sharpMs: number; core: CoreWork };

enum BenchCase {
  Steady = 'steady',
  FirstZoom = 'first-zoom'
}

const CASE = (process.env.BENCH_CASE ?? BenchCase.Steady) as BenchCase;
const ASSET_LATENCY_MS = [120, 260, 420];
const FIT_ZOOM = 0.06;
const FIRST_ZOOM_TARGET = 1.2;
const RUNS = Number(process.env.BENCH_RUNS ?? 5);
const CPU_THROTTLE = Number(process.env.BENCH_CPU ?? 4);
const OUT = process.env.BENCH_OUT ?? 'perf-results';
const TRACE_OVER_MS = Number(process.env.BENCH_TRACE_OVER_MS ?? 0);
const PROFILED = process.env.BENCH_PROFILE === '1';
const CI_GPU_ARGS = ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--disable-gpu-vsync'];
const VIEWPORT = { width: 1440, height: 900 };
const LOCAL_USER_ID = '00000000-0000-4000-8000-00000000f002';
const START_ZOOM = 0.5;
const viewAt = (zoom: number) => ({ x: VIEWPORT.width / 2 - ZOOM_FIXTURE_CENTRE.x * zoom, y: VIEWPORT.height / 2 - ZOOM_FIXTURE_CENTRE.y * zoom, zoom });
const START_VIEW = viewAt(CASE === BenchCase.FirstZoom ? FIT_ZOOM : START_ZOOM);
const VIEW_KEY = `feega:viewport:${LOCAL_USER_ID}:${ZOOM_FIXTURE_PLACE.canvasId}`;
const SETTLE_MS = 8000;
const GESTURE_MS = 4000;
const SHARP_POLL_MS = 60;
const SHARP_GIVE_UP_MS = 15_000;
const BURST_STEPS = 12;
const MS_PER_S = 1000;
const TRACE_CATEGORIES = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'v8.execute', 'v8', 'blink.user_timing', 'gpu', 'disabled-by-default-v8.gc', 'toplevel'];

const shot = (page: Page) => page.screenshot({ clip: { x: 0, y: 0, ...VIEWPORT } });

async function untilSharp(page: Page): Promise<number> {
  const started = Date.now();
  let last = await shot(page);
  while (Date.now() - started < SHARP_GIVE_UP_MS) {
    await page.waitForTimeout(SHARP_POLL_MS);
    const next = await shot(page);
    if (next.equals(last)) {
      return Date.now() - started;
    }
    last = next;
  }
  return SHARP_GIVE_UP_MS;
}

async function burst(page: Page) {
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
  await page.keyboard.down('Control');
  for (let i = 0; i < BURST_STEPS; i++) {
    await page.mouse.wheel(0, -60);
  }
  await page.keyboard.up('Control');
}

async function zoomIn(page: Page, until: number) {
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
  await page.keyboard.down('Control');
  while (Date.now() < until) {
    const zoom = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{"zoom":0}').zoom as number, VIEW_KEY);
    await page.mouse.wheel(0, zoom < FIRST_ZOOM_TARGET ? -40 : 0);
  }
  await page.keyboard.up('Control');
}

async function taskMs(cdp: CDPSession): Promise<number> {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return (metrics.find((m) => m.name === 'TaskDuration')?.value ?? 0) * MS_PER_S;
}

async function traced<T>(cdp: CDPSession, work: () => Promise<T>): Promise<{ result: T; events: unknown[] }> {
  const events: unknown[] = [];
  cdp.on('Tracing.dataCollected', ({ value }) => events.push(...value));
  await cdp.send('Tracing.start', { traceConfig: { includedCategories: TRACE_CATEGORIES }, transferMode: 'ReportEvents' });
  const result = await work();
  const done = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve));
  await cdp.send('Tracing.end');
  await done;
  return { result, events };
}

async function run(browser: Browser, base: string, index: number): Promise<BenchRun> {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(instrument);
  await page.addInitScript(({ key, view }) => localStorage.setItem(key, JSON.stringify(view)), { key: VIEW_KEY, view: START_VIEW });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  let served = 0;
  await page.route('**/assets/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ASSET_LATENCY_MS[served++ % ASSET_LATENCY_MS.length]));
    await route.continue();
  });

  await page.goto(`${base}/p/${ZOOM_FIXTURE_PLACE.projectId}/c/${ZOOM_FIXTURE_PLACE.canvasId}${process.env.BENCH_QUERY ?? ""}`, { waitUntil: 'commit' });
  await page.locator('[data-canvas-surface]').first().waitFor({ timeout: 120_000 });
  await page.waitForTimeout(SETTLE_MS);

  console.log(`webgpu adapter: ${await page.evaluate(async () => !!(await (navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu?.requestAdapter()))}`);
  const cpuBefore = await taskMs(cdp);
  const gesture = () => measure(page, GESTURE_MS, (until) => (CASE === BenchCase.FirstZoom ? zoomIn(page, until) : wheelZoom(page, until)));
  if (PROFILED) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.start');
  }
  const { result: zoom, events } = TRACE_OVER_MS ? await traced(cdp, gesture) : { result: await gesture(), events: [] };
  if (PROFILED) {
    writeFileSync(join(OUT, `zoom-run${index}.cpuprofile`), JSON.stringify((await cdp.send('Profiler.stop')).profile));
  }
  const cpuMs = Math.round((await taskMs(cdp)) - cpuBefore);
  if (TRACE_OVER_MS && zoom.max > TRACE_OVER_MS) {
    writeFileSync(join(OUT, `trace-run${index}-${Math.round(zoom.max)}ms.json`), JSON.stringify({ traceEvents: events }));
  }

  await page.waitForTimeout(SETTLE_MS);
  await burst(page);
  const sharpMs = await untilSharp(page);
  writeFileSync(join(OUT, `settled-run${index}.png`), await shot(page));
  if (index === 0) {
    writeFileSync(join(OUT, 'zoomed-settled.png'), await shot(page));
  }
  await context.close();
  return { fps: zoom.fpsAvg, p95: zoom.p95, p99: zoom.p99, over11: zoom.over11, worst: zoom.max, frames: zoom.frames, cpuMs, sharpMs, core: zoom.core };
}

test('zoom benchmark on the synthetic heavy canvas', async ({ baseURL }) => {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: false, args: process.env.CI ? CI_GPU_ARGS : ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  const runs: BenchRun[] = [];
  for (let i = 0; i < RUNS; i++) {
    runs.push(await run(browser, baseURL!, i));
    console.log(`run ${i + 1}/${RUNS} ${JSON.stringify(runs.at(-1))}`);
  }
  await browser.close();
  writeFileSync(join(OUT, 'zoom-bench.json'), JSON.stringify({ cpuThrottle: CPU_THROTTLE, runs, median: median(runs) }, null, 2));
  expect(runs.every((r) => r.frames > 0)).toBe(true);
});
