import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, chromium, type CDPSession, type Page } from '@playwright/test';
import { instrument, measure, type Frames } from '../e2e/fixtures/frame-sweeps';
import { ZOOM_FIXTURE_CENTRE, ZOOM_FIXTURE_PLACE } from '../../scripts/perf/zoom-fixture.mjs';
import { LANDINGS_FIXTURE_CENTRE, LANDINGS_FIXTURE_PLACE } from '../../scripts/perf/landings-fixture.mjs';
import { levelSharpMs, median, type LevelFrame } from '../../scripts/perf/bench-stats.mjs';
import { Ease, WHEEL_ZOOM, dragPan, panPath, playDrag, playWheel, zoomPath, type DragPoint, type Point, type Step } from '../../scripts/perf/gestures';

enum Fixture {
  Zoom = 'zoom',
  Landings = 'landings'
}

enum Speed {
  Fast = 'fast',
  Medium = 'medium',
  Slow = 'slow'
}

enum Scenario {
  ZoomSweep = 'zoom-sweep',
  ZoomFarOut = 'zoom-far-out',
  ZoomFarIn = 'zoom-far-in',
  ZoomHunt = 'zoom-hunt',
  PanWheel = 'pan-wheel',
  PanDrag = 'pan-drag',
  PanWhileZooming = 'pan-zoom',
  ZoomDeep = 'zoom-deep'
}

type Settle = { sharpMs: number; settledMs: number; restBakes: number; asked: number; built: number };
type Levels = { levels: number; levelSharpP50: number; levelSharpP95: number; superseded: number };
type Perceived = { centreSharpMs: number; screenSharpMs: number; restStartMs: number; finalMs: number; tilesDuring: number; tilesAfter: number; uploadAfterMb: number; lastUploadMs: number };
type ScenarioRun = Frames & Settle & Levels & Perceived & { cpuMs: number; fpsByThird: number[] | null };
type PerceivedFrame = LevelFrame & { at: number; moving: boolean; tiles: number; stillBlocks: number; unsharp: number; unsharpCentre: number; exact: boolean; uploadBytes: number };
type Script = { wheel: Step[]; from?: number } | { drag: DragPoint[] };

const FIXTURE = (process.env.BENCH_CASE ?? Fixture.Zoom) as Fixture;
const PLACES = { [Fixture.Zoom]: { place: ZOOM_FIXTURE_PLACE, centre: ZOOM_FIXTURE_CENTRE }, [Fixture.Landings]: { place: LANDINGS_FIXTURE_PLACE, centre: LANDINGS_FIXTURE_CENTRE } };
const RUNS = Number(process.env.BENCH_RUNS ?? 3);
const CPU_THROTTLE = Number(process.env.BENCH_CPU ?? 1);
const OUT = process.env.BENCH_OUT ?? 'perf-results';
const QUERY = process.env.BENCH_TILES === 'off' ? '?coreTiles=0' : '';
const ONLY = process.env.BENCH_SCENARIOS?.split(',') ?? null;
const PROFILED = process.env.BENCH_PROFILE === '1';
const DUMPED = process.env.BENCH_DUMP === '1';
const SPEED = (process.env.BENCH_SPEED ?? Speed.Fast) as Speed;
const STRETCH: Record<Speed, number> = { [Speed.Fast]: 1, [Speed.Medium]: 2.5, [Speed.Slow]: 6 };
const EASE: Record<Speed, Ease> = { [Speed.Fast]: Ease.Flick, [Speed.Medium]: Ease.Smooth, [Speed.Slow]: Ease.Smooth };
const ms = (fast: number) => fast * STRETCH[SPEED];
const VIEWPORT = { width: 1440, height: 900 };
const CENTRE: Point = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };
const LOCAL_USER_ID = '00000000-0000-4000-8000-00000000f002';
const START_ZOOM = 0.4;
const BEYOND_OUT = 0.02;
const BEYOND_IN = 8;
const CAMERA_RANGE = { min: 0.05, max: 4 };
const THIRDS = 3;
const OPEN_SETTLE_MS = 8000;
const BETWEEN_MS = 1500;
const SHARP_GIVE_UP_MS = 15_000;
const REST_WATCH_MS = 2000;
const POLL_MS = 50;
const { place, centre } = PLACES[FIXTURE];
const VIEW_KEY = `feega:viewport:${LOCAL_USER_ID}:${place.canvasId}`;
const START_VIEW = { x: CENTRE.x - centre.x * START_ZOOM, y: CENTRE.y - centre.y * START_ZOOM, zoom: START_ZOOM };

const SCRIPTS: Record<Scenario, () => Script> = {
  [Scenario.ZoomSweep]: () => ({
    from: START_ZOOM,
    wheel: zoomPath({
      from: START_ZOOM,
      anchor: CENTRE,
      ease: EASE[SPEED], clamp: CAMERA_RANGE,
      legs: [{ to: BEYOND_OUT, ms: ms(300) }, { to: BEYOND_IN, ms: ms(800) }, { to: BEYOND_OUT, ms: ms(800) }, { to: BEYOND_IN, ms: ms(800) }, { to: BEYOND_OUT, ms: ms(800) }, { to: START_ZOOM, ms: ms(300) }]
    })
  }),
  [Scenario.ZoomFarOut]: () => ({ from: START_ZOOM, wheel: zoomPath({ from: START_ZOOM, anchor: CENTRE, ease: EASE[SPEED], clamp: CAMERA_RANGE, legs: [{ to: BEYOND_OUT, ms: ms(400) }] }) }),
  [Scenario.ZoomFarIn]: () => ({ from: CAMERA_RANGE.min, wheel: zoomPath({ from: CAMERA_RANGE.min, anchor: CENTRE, ease: EASE[SPEED], clamp: CAMERA_RANGE, legs: [{ to: BEYOND_IN, ms: ms(800) }] }) }),
  [Scenario.ZoomHunt]: () => ({
    from: CAMERA_RANGE.max,
    wheel: zoomPath({
      from: CAMERA_RANGE.max,
      anchor: CENTRE,
      ease: EASE[SPEED], clamp: CAMERA_RANGE,
      legs: [{ to: 0.55, ms: ms(400) }, { to: 0.47, ms: ms(120) }, { to: 0.55, ms: ms(120) }, { to: 0.47, ms: ms(120) }, { to: 0.55, ms: ms(120) }, { to: START_ZOOM, ms: ms(200) }]
    })
  }),
  [Scenario.ZoomDeep]: () => ({ from: START_ZOOM, wheel: zoomPath({ from: START_ZOOM, anchor: CENTRE, ease: EASE[SPEED], clamp: CAMERA_RANGE, legs: [{ to: CAMERA_RANGE.max, ms: ms(800) }] }) }),
  [Scenario.PanWheel]: () => ({
    wheel: panPath({ at: CENTRE, tailMs: ms(500), legs: [{ by: { x: 6000, y: 0 }, ms: ms(900) }, { by: { x: -8000, y: 0 }, ms: ms(1100) }, { by: { x: 3000, y: 2000 }, ms: ms(600) }] })
  }),
  [Scenario.PanDrag]: () => ({
    drag: dragPan({ at: CENTRE, legs: [{ by: { x: 600, y: 0 }, ms: ms(300) }, { by: { x: -1100, y: 250 }, ms: ms(450) }, { by: { x: 500, y: -250 }, ms: ms(300) }] })
  }),
  [Scenario.PanWhileZooming]: () => {
    const steps = zoomPath({ from: START_ZOOM, anchor: CENTRE, ease: EASE[SPEED], clamp: CAMERA_RANGE, legs: [{ to: 1.2, ms: ms(500) }, { to: START_ZOOM, ms: ms(500) }] });
    const from = { x: 300, y: 200 };
    const to = { x: 1100, y: 700 };
    return { from: START_ZOOM, wheel: steps.map((s, i) => ({ ...s, x: from.x + ((to.x - from.x) * i) / steps.length, y: from.y + ((to.y - from.y) * i) / steps.length })) };
  }
};

function fpsByThird(script: Script, gaps: number[]): number[] | null {
  if (!('wheel' in script) || !script.wheel.some((s) => s.ctrl)) {
    return null;
  }
  const lo = Math.log(CAMERA_RANGE.min);
  const span = Math.log(CAMERA_RANGE.max) - lo;
  let zoom = script.from ?? START_ZOOM;
  let next = 0;
  let t = 0;
  const time = Array(THIRDS).fill(0);
  const frames = Array(THIRDS).fill(0);
  for (const gap of gaps) {
    t += gap;
    while (next < script.wheel.length && script.wheel[next].at <= t) {
      zoom = Math.min(CAMERA_RANGE.max, Math.max(CAMERA_RANGE.min, zoom * Math.exp(-script.wheel[next].dy * WHEEL_ZOOM)));
      next++;
    }
    const third = Math.min(THIRDS - 1, Math.floor(((Math.log(zoom) - lo) / span) * THIRDS));
    time[third] += gap;
    frames[third] += 1;
  }
  return time.map((ms, i) => (ms ? Math.round((frames[i] * 1000) / ms) : 0));
}

const lengthOf = (script: Script) => ('wheel' in script ? script.wheel : script.drag).at(-1)!.at;

function watchInput() {
  const seen = { last: 0 };
  (window as unknown as { __lastInput: typeof seen }).__lastInput = seen;
  const note = (e: Event) => {
    seen.last = e.timeStamp;
  };
  addEventListener('wheel', note, { capture: true, passive: true });
  addEventListener('pointermove', note, { capture: true, passive: true });
}

async function taskMs(cdp: CDPSession): Promise<number> {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return (metrics.find((m) => m.name === 'TaskDuration')?.value ?? 0) * 1000;
}

async function settle(page: Page, since: number): Promise<Settle> {
  const end = await page.evaluate(() => (window as unknown as { __lastInput: { last: number } }).__lastInput.last);
  const started = Date.now();
  let sharpAt = 0;
  let settledAt = 0;
  while (Date.now() - started < SHARP_GIVE_UP_MS && !settledAt) {
    await page.waitForTimeout(POLL_MS);
    ({ sharpAt, settledAt } = await page.evaluate((after) => {
      const frames = (window as unknown as { __gpuCanvas?: { frames?: { at: number; unsharp: number; pending: boolean; moving: boolean }[] } }).__gpuCanvas?.frames ?? [];
      const later = frames.filter((f) => f.at > after && !f.moving);
      return { sharpAt: later.find((f) => f.unsharp === 0)?.at ?? 0, settledAt: later.find((f) => f.unsharp === 0 && !f.pending)?.at ?? 0 };
    }, end));
  }
  await page.waitForTimeout(REST_WATCH_MS);
  return page.evaluate(({ end, since, sharpAt, settledAt, giveUp }) => {
    const frames = (window as unknown as { __gpuCanvas?: { frames?: { at: number; bakes: number }[] } }).__gpuCanvas?.frames ?? [];
    const marks = performance.getEntriesByType('mark').filter((m) => m.startTime >= since);
    const restFrom = settledAt || end + giveUp;
    return {
      sharpMs: sharpAt ? Math.round(sharpAt - end) : giveUp,
      settledMs: settledAt ? Math.round(settledAt - end) : giveUp,
      restBakes: frames.filter((f) => f.at > restFrom && f.bakes > 0).length,
      asked: marks.filter((m) => m.name.startsWith('frame|asked|')).length,
      built: marks.filter((m) => m.name.startsWith('frame|built|')).length
    };
  }, { end, since, sharpAt, settledAt, giveUp: SHARP_GIVE_UP_MS });
}

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? Math.round(sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]) : 0;
};

async function levels(page: Page, since: number, name: Scenario): Promise<Levels> {
  const frames = await page.evaluate((after) => ((window as unknown as { __gpuCanvas?: { frames?: LevelFrame[] } }).__gpuCanvas?.frames ?? []).filter((f) => f.at > after), since);
  if (DUMPED) {
    writeFileSync(join(OUT, `${name}-frames-${Date.now()}.json`), JSON.stringify(frames));
  }
  const { times, superseded } = levelSharpMs(frames);
  return { levels: times.length + superseded, levelSharpP50: percentile(times, 0.5), levelSharpP95: percentile(times, 0.95), superseded };
}

const MB = 1 << 20;

function sharpAfter(frames: PerceivedFrame[], end: number, blurred: (f: PerceivedFrame) => boolean): number {
  const last = frames.findLastIndex(blurred);
  if (last < 0) {
    return 0;
  }
  const next = frames[last + 1];
  return next ? Math.max(0, Math.round(next.at - end)) : SHARP_GIVE_UP_MS;
}

function idleTailMs(script: Script): number {
  if (!('wheel' in script)) {
    return 0;
  }
  let zoom = script.from ?? START_ZOOM;
  let movedAt = 0;
  for (const step of script.wheel) {
    const next = step.ctrl ? Math.min(CAMERA_RANGE.max, Math.max(CAMERA_RANGE.min, zoom * Math.exp(-step.dy * WHEEL_ZOOM))) : zoom;
    if (next !== zoom || !step.ctrl) {
      movedAt = step.at;
    }
    zoom = next;
  }
  return script.wheel.at(-1)!.at - movedAt;
}

async function perceived(page: Page, since: number, script: Script): Promise<Perceived> {
  const lastInput = await page.evaluate(() => (window as unknown as { __lastInput: { last: number } }).__lastInput.last);
  const end = lastInput - idleTailMs(script);
  const all = await page.evaluate((after) => ((window as unknown as { __gpuCanvas?: { frames?: PerceivedFrame[] } }).__gpuCanvas?.frames ?? []).filter((f) => f.at > after), since);
  const after = all.filter((f) => f.at > end);
  const from = (f: PerceivedFrame | undefined) => (f ? Math.round(f.at - end) : SHARP_GIVE_UP_MS);
  const uploads = after.filter((f) => f.uploadBytes > 0);
  const final = after.find((f, i) => f.exact && after.slice(i).every((g) => g.unsharp === 0));
  return {
    centreSharpMs: sharpAfter(after, end, (f) => f.unsharpCentre > 0),
    screenSharpMs: sharpAfter(after, end, (f) => f.unsharp > 0),
    restStartMs: from(after.find((f) => f.stillBlocks > 0 || f.exact)),
    finalMs: from(final),
    tilesDuring: all.filter((f) => f.at <= end).reduce((s, f) => s + f.tiles, 0),
    tilesAfter: after.reduce((s, f) => s + f.tiles, 0),
    uploadAfterMb: Math.round((uploads.reduce((s, f) => s + f.uploadBytes, 0) / MB) * 10) / 10,
    lastUploadMs: uploads.length ? from(uploads.at(-1)) : 0
  };
}

async function scenario(page: Page, cdp: CDPSession, name: Scenario, profiled: boolean): Promise<ScenarioRun> {
  const script = SCRIPTS[name]();
  const since = await page.evaluate(() => performance.now());
  const play = () => ('wheel' in script ? playWheel(cdp, script.wheel) : playDrag(cdp, script.drag, 'middle'));
  if (profiled) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.start');
  }
  const cpuBefore = await taskMs(cdp);
  const frames = await measure(page, lengthOf(script), play);
  const cpuMs = Math.round((await taskMs(cdp)) - cpuBefore);
  const settled = await settle(page, since);
  if (profiled) {
    writeFileSync(join(OUT, `${name}.cpuprofile`), JSON.stringify((await cdp.send('Profiler.stop')).profile));
  }
  return { ...frames, cpuMs, fpsByThird: fpsByThird(script, frames.gapsInOrder), ...settled, ...(await perceived(page, since, script)), ...(await levels(page, since, name)) };
}

async function run(index: number, base: string, browser: Awaited<ReturnType<typeof chromium.launch>>): Promise<Partial<Record<Scenario, ScenarioRun>>> {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(instrument);
  await page.addInitScript(watchInput);
  await page.addInitScript(({ key, view }) => localStorage.setItem(key, JSON.stringify(view)), { key: VIEW_KEY, view: START_VIEW });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  await page.goto(`${base}/p/${place.projectId}/c/${place.canvasId}${QUERY}`, { waitUntil: 'commit' });
  await page.locator('[data-canvas-surface]').first().waitFor({ timeout: 120_000 });
  await page.waitForTimeout(OPEN_SETTLE_MS);
  const result: Partial<Record<Scenario, ScenarioRun>> = {};
  for (const name of Object.values(Scenario).filter((s) => !ONLY || ONLY.includes(s))) {
    result[name] = await scenario(page, cdp, name, PROFILED && index === 0);
    await page.waitForTimeout(BETWEEN_MS);
  }
  if (index === 0) {
    writeFileSync(join(OUT, 'gesture-end.png'), await page.screenshot());
  }
  await context.close();
  return result;
}

test('gesture benchmark: gradual zoom and pan through real input', async ({ baseURL }) => {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  const runs: Partial<Record<Scenario, ScenarioRun>>[] = [];
  for (let i = 0; i < RUNS; i++) {
    runs.push(await run(i, baseURL!, browser));
    console.log(`run ${i + 1}/${RUNS} ${JSON.stringify(Object.fromEntries(Object.entries(runs.at(-1)!).map(([k, v]) => [k, { fps: v.fpsAvg, cpuMs: v.cpuMs, p50: v.p50, p95: v.p95, p99: v.p99, worst: v.max, over11: v.over11, thirds: v.fpsByThird, sharpMs: v.sharpMs, settledMs: v.settledMs, levels: v.levels, levelP50: v.levelSharpP50, levelP95: v.levelSharpP95, superseded: v.superseded, over11Pct: Math.round((v.over11 / Math.max(1, v.frames)) * 1000) / 10, centreSharpMs: v.centreSharpMs, screenSharpMs: v.screenSharpMs, restStartMs: v.restStartMs, finalMs: v.finalMs, tilesDuring: v.tilesDuring, tilesAfter: v.tilesAfter, uploadAfterMb: v.uploadAfterMb, lastUploadMs: v.lastUploadMs, restBakes: v.restBakes, asked: v.asked, built: v.built }])))}`);
  }
  await browser.close();
  const medians = Object.fromEntries(Object.values(Scenario).filter((s) => runs[0][s]).map((s) => [s, median(runs.map((r) => ({ fps: r[s]!.fpsAvg, p95: r[s]!.p95, worst: r[s]!.max, cpuMs: r[s]!.cpuMs, sharpMs: r[s]!.sharpMs })))]));
  writeFileSync(join(OUT, `gesture-bench-${FIXTURE}-${SPEED}-${CPU_THROTTLE}x${QUERY ? '-tiles-off' : ''}.json`), JSON.stringify({ fixture: FIXTURE, speed: SPEED, cpuThrottle: CPU_THROTTLE, tiles: QUERY ? 'off' : 'on', runs, medians }, null, 2));
  expect(runs.every((r) => Object.values(r).every((s) => s.frames > 0))).toBe(true);
});
