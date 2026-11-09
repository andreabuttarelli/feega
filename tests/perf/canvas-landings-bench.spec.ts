import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, chromium, webkit, type Browser, type BrowserContext, type CDPSession, type Page } from '@playwright/test';
import { instrument, measure, wheelPan, wheelZoom, type Frames } from '../e2e/fixtures/frame-sweeps';
import { LANDINGS_FIXTURE_CENTRE, LANDINGS_FIXTURE_PLACE } from '../../scripts/perf/landings-fixture.mjs';
import { mid } from '../../scripts/perf/bench-stats.mjs';

enum Engine {
  Chromium = 'chromium',
  Webkit = 'webkit'
}

enum Gesture {
  Pan = 'pan',
  Zoom = 'zoom',
  Fit = 'fit',
  Drag = 'drag'
}

type GestureRun = { fps: number; p95: number; worst: number; frames: number; cpuMs: number | null };
type BenchRun = Record<Gesture, GestureRun> & { sharpMs: number };
type Hotspot = { fn: string; url: string; selfMs: number };

const ENGINE = (process.env.BENCH_ENGINE ?? Engine.Chromium) as Engine;
const RUNS = Number(process.env.BENCH_RUNS ?? 5);
const CPU_THROTTLE = Number(process.env.BENCH_CPU ?? 4);
const OUT = process.env.BENCH_OUT ?? 'perf-results';
const VIEWPORT = { width: 1440, height: 900 };
const LOCAL_USER_ID = '00000000-0000-4000-8000-00000000f002';
const START_ZOOM = 0.12;
const START_VIEW = { x: VIEWPORT.width / 2 - LANDINGS_FIXTURE_CENTRE.x * START_ZOOM, y: VIEWPORT.height / 2 - LANDINGS_FIXTURE_CENTRE.y * START_ZOOM, zoom: START_ZOOM };
const VIEW_KEY = `feega:viewport:${LOCAL_USER_ID}:${LANDINGS_FIXTURE_PLACE.canvasId}`;
const SETTLE_MS = 8000;
const GESTURE_MS = 4000;
const FIT_TOGGLE_MS = 700;
const DRAG_FROM = { x: 790, y: 450 };
const SHARP_POLL_MS = 60;
const SHARP_GIVE_UP_MS = 15_000;
const BURST_STEPS = 12;
const MS_PER_S = 1000;
const US_PER_MS = 1000;
const HOTSPOTS = 25;

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

async function fitToggle(page: Page, until: number) {
  for (let i = 0; Date.now() < until; i++) {
    await page.keyboard.press(i % 2 ? 'Shift+Digit0' : 'Shift+Digit1');
    await page.waitForTimeout(FIT_TOGGLE_MS);
  }
}

async function dragFrame(page: Page, until: number) {
  await page.mouse.click(DRAG_FROM.x, DRAG_FROM.y);
  await page.mouse.down();
  for (let i = 0; Date.now() < until; i++) {
    const t = i / 10;
    await page.mouse.move(DRAG_FROM.x + Math.sin(t) * 200, DRAG_FROM.y + Math.cos(t * 0.7) * 150);
  }
  await page.mouse.up();
}

const GESTURES: Record<Gesture, (page: Page, until: number) => Promise<void>> = {
  [Gesture.Pan]: wheelPan,
  [Gesture.Zoom]: wheelZoom,
  [Gesture.Fit]: fitToggle,
  [Gesture.Drag]: dragFrame
};

async function taskMs(cdp: CDPSession | null): Promise<number | null> {
  if (!cdp) {
    return null;
  }
  const { metrics } = await cdp.send('Performance.getMetrics');
  return (metrics.find((m) => m.name === 'TaskDuration')?.value ?? 0) * MS_PER_S;
}

type ProfileNode = { id: number; callFrame: { functionName: string; url: string; lineNumber: number }; children?: number[] };
type Profile = { nodes: ProfileNode[]; samples: number[]; timeDeltas: number[] };

function hotspots(profile: Profile): Hotspot[] {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map<string, Hotspot>();
  profile.samples.forEach((id, i) => {
    const frame = byId.get(id)!.callFrame;
    const key = `${frame.functionName}@${frame.url}:${frame.lineNumber}`;
    const spot = self.get(key) ?? { fn: frame.functionName || '(anonymous)', url: `${frame.url.split('/').pop()}:${frame.lineNumber}`, selfMs: 0 };
    spot.selfMs += (profile.timeDeltas[i] ?? 0) / US_PER_MS;
    self.set(key, spot);
  });
  return [...self.values()].filter((s) => s.fn !== '(idle)').sort((a, b) => b.selfMs - a.selfMs).slice(0, HOTSPOTS).map((s) => ({ ...s, selfMs: Math.round(s.selfMs) }));
}

async function open(browser: Browser, base: string): Promise<{ context: BrowserContext; page: Page; cdp: CDPSession | null }> {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(instrument);
  await page.addInitScript(({ key, view }) => localStorage.setItem(key, JSON.stringify(view)), { key: VIEW_KEY, view: START_VIEW });
  const cdp = ENGINE === Engine.Chromium ? await context.newCDPSession(page) : null;
  await cdp?.send('Performance.enable');
  await cdp?.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  await page.goto(`${base}/p/${LANDINGS_FIXTURE_PLACE.projectId}/c/${LANDINGS_FIXTURE_PLACE.canvasId}`, { waitUntil: 'commit' });
  await page.locator('[data-canvas-surface]').first().waitFor({ timeout: 120_000 });
  await page.waitForTimeout(SETTLE_MS);
  return { context, page, cdp };
}

async function gestureRun(page: Page, cdp: CDPSession | null, gesture: Gesture): Promise<GestureRun> {
  await page.keyboard.press('Escape');
  await page.evaluate(({ key, view }) => localStorage.setItem(key, JSON.stringify(view)), { key: VIEW_KEY, view: START_VIEW });
  const before = await taskMs(cdp);
  const frames: Frames = await measure(page, GESTURE_MS, (until) => GESTURES[gesture](page, until));
  const after = await taskMs(cdp);
  return { fps: frames.fpsAvg, p95: frames.p95, worst: frames.max, frames: frames.frames, cpuMs: before === null || after === null ? null : Math.round(after - before) };
}

async function profiledRun(page: Page, cdp: CDPSession | null, gesture: Gesture, profiled: boolean): Promise<{ frames: GestureRun; spots: Hotspot[] }> {
  if (!profiled || !cdp) {
    return { frames: await gestureRun(page, cdp, gesture), spots: [] };
  }
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.start');
  const frames = await gestureRun(page, cdp, gesture);
  return { frames, spots: hotspots((await cdp.send('Profiler.stop')).profile as Profile) };
}

async function run(browser: Browser, base: string, index: number, profiled: boolean): Promise<{ run: BenchRun; spots: Partial<Record<Gesture, Hotspot[]>> }> {
  const { context, page, cdp } = await open(browser, base);
  if (index === 0) {
    writeFileSync(join(OUT, `landings-${ENGINE}-start.png`), await shot(page));
  }

  const result = {} as BenchRun;
  const spots: Partial<Record<Gesture, Hotspot[]>> = {};
  for (const gesture of Object.values(Gesture)) {
    const done = await profiledRun(page, cdp, gesture, profiled);
    result[gesture] = done.frames;
    spots[gesture] = done.spots;
    await page.waitForTimeout(SETTLE_MS / 4);
  }

  await page.reload({ waitUntil: 'commit' });
  await page.locator('[data-canvas-surface]').first().waitFor({ timeout: 120_000 });
  await page.waitForTimeout(SETTLE_MS);
  await burst(page);
  result.sharpMs = await untilSharp(page);
  if (index === 0) {
    writeFileSync(join(OUT, `landings-${ENGINE}-zoomed.png`), await shot(page));
  }
  await context.close();
  return { run: result, spots };
}

function medianOf(runs: BenchRun[]) {
  const pick = (values: (number | null)[]) => (values.some((v) => v === null) ? null : mid(values as number[]));
  const gestures = Object.fromEntries(Object.values(Gesture).map((g) => [g, Object.fromEntries((['fps', 'p95', 'worst', 'cpuMs'] as const).map((k) => [k, pick(runs.map((r) => r[g][k]))]))]));
  return { ...gestures, sharpMs: mid(runs.map((r) => r.sharpMs)) };
}

test('landings benchmark: imported pages with responsive views', async ({ baseURL }) => {
  mkdirSync(OUT, { recursive: true });
  const browser = ENGINE === Engine.Webkit ? await webkit.launch({ headless: false }) : await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  const runs: BenchRun[] = [];
  let spots: Partial<Record<Gesture, Hotspot[]>> = {};
  for (let i = 0; i < RUNS; i++) {
    const done = await run(browser, baseURL!, i, i === 0);
    runs.push(done.run);
    spots = i === 0 ? done.spots : spots;
    console.log(`run ${i + 1}/${RUNS} ${JSON.stringify(done.run)}`);
  }
  await browser.close();
  const cpuThrottle = ENGINE === Engine.Chromium ? CPU_THROTTLE : null;
  writeFileSync(join(OUT, `landings-bench-${ENGINE}-${cpuThrottle ?? 'na'}x.json`), JSON.stringify({ engine: ENGINE, cpuThrottle, runs, median: medianOf(runs), hotspots: spots }, null, 2));
  expect(runs.every((r) => r.pan.frames > 0)).toBe(true);
});
