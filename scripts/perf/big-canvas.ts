import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium, type Browser, type CDPSession, type Page } from '@playwright/test';
import sharp from 'sharp';
import { instrument, measure, wheelPan, wheelZoom, type Frames } from '../../tests/e2e/fixtures/frame-sweeps';

const BASE = process.env.PERF_BASE ?? 'http://localhost:5188';
const OUT = process.env.PERF_OUT ?? new URL('./out/', import.meta.url).pathname;
const FIXTURE = JSON.parse(readFileSync(new URL('./fixture.json', import.meta.url), 'utf8')) as { projectId: string; canvasId: string };
const VIEWPORT = { width: 1440, height: 900 };
const RUNS = Number(process.env.PERF_RUNS ?? 3);
const POLL_MS = 400;
const LOAD_TIMEOUT_MS = 45_000;
const SETTLE_MS = 25_000;
const SWEEP_MS = 6_000;
const STABLE_POLLS = 2;
const FLAT_STDEV = 2;
const MIN_NODE_PX = 6;
const BG_TOLERANCE = 3;
const TARGET_ZOOM = Number(process.env.PERF_ZOOM ?? 0.5);
const ZOOM_TOLERANCE = 0.08;
const ZOOM_STEP_LIMIT = 40;
const THROTTLE_PHONE = 4;
const PROFILE_TOP = 15;
const CLOSE_TIMEOUT_MS = 10_000;
const TSX_NAME_SHIM = 'window.__name = (f) => f;';
const TRACE = process.env.PERF_TRACE === '1';
const TRACE_CATEGORIES = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'v8', 'v8.execute', 'disabled-by-default-v8.cpu_profiler', 'disabled-by-default-v8.gc', 'blink.user_timing', 'gpu', 'viz', 'webgpu', 'disabled-by-default-webgpu', 'gpu.dawn', 'disabled-by-default-gpu.dawn'];

type Config = { renderer: string; query: string; throttle: number };
type Run = {
  config: Config;
  firstNodeMs: number;
  firstPaintMs: number;
  fcpMs: number;
  fullPaintMs: number;
  settledBlank: number;
  blankAtFirstNode: number;
  flashes: number;
  heapLoadMb: number;
  heapPeakMb: number;
  panFit: Frames;
  zoom: Frames;
  panZoomed: Frames;
  longTasks: number;
  longTaskMs: number;
};

const ONLY = process.env.PERF_ONLY?.split(',');
const THROTTLES = (process.env.PERF_THROTTLES ?? `1,${THROTTLE_PHONE}`).split(',').map(Number);
const RENDERERS = [
  { renderer: 'default', query: '' },
  { renderer: 'webgpu', query: 'renderer=webgpu' }
].filter((r) => !ONLY || ONLY.includes(r.renderer));

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);
const urlOf = (query: string) => `${BASE}/p/${FIXTURE.projectId}/c/${FIXTURE.canvasId}?${[query, 'perf=1'].filter(Boolean).join('&')}`;

async function login(browser: Browser): Promise<string> {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
  await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
  await page.press('input[type=password]', 'Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'commit' });
  await page.waitForTimeout(2000);
  const state = `${OUT}/state.json`;
  await context.storageState({ path: state });
  await context.close();
  return state;
}

type Box = { id: string; x: number; y: number; w: number; h: number };

async function boxes(page: Page): Promise<Box[]> {
  return page.evaluate(
    ([min, vw, vh]) => {
      const surface = document.querySelector('.svelte-flow[data-canvas-surface]')?.getBoundingClientRect() ?? { left: 0, top: 0, right: vw, bottom: vh };
      return [...document.querySelectorAll('.svelte-flow__node')].flatMap((el) => {
        const r = el.getBoundingClientRect();
        const x = Math.max(surface.left, r.left + 1);
        const y = Math.max(surface.top, r.top + 1);
        const w = Math.min(surface.right, r.right - 1) - x;
        const h = Math.min(surface.bottom, r.bottom - 1) - y;
        return w >= min && h >= min ? [{ id: el.getAttribute('data-id')!, x: Math.floor(x), y: Math.floor(y), w: Math.floor(w), h: Math.floor(h) }] : [];
      });
    },
    [MIN_NODE_PX, VIEWPORT.width, VIEWPORT.height] as const
  );
}

async function flatNodes(page: Page, keep?: string): Promise<{ flat: Set<string>; all: Set<string>; seen: number }> {
  const list = await boxes(page);
  const shot = await page.screenshot({ type: 'png' });
  if (keep) {
    writeFileSync(keep, shot);
  }
  const pane = await page.locator('.svelte-flow[data-canvas-surface]').first().boundingBox();
  const probe = { left: Math.floor((pane?.x ?? 0) + 4), top: Math.floor((pane?.y ?? 0) + 4), width: 3, height: 3 };
  const bg = (await sharp(shot).extract(probe).stats()).channels.map((c) => c.mean);
  const flat = new Set<string>();
  for (const b of list) {
    const stats = await sharp(shot).extract({ left: b.x, top: b.y, width: b.w, height: b.h }).stats();
    const looksEmpty = stats.channels.every((c, i) => c.stdev < FLAT_STDEV && Math.abs(c.mean - bg[i]) < BG_TOLERANCE);
    if (looksEmpty) {
      flat.add(b.id);
    }
  }
  return { flat, all: new Set(list.map((b) => b.id)), seen: list.length };
}

async function heapMb(cdp: CDPSession): Promise<number> {
  await cdp.send('HeapProfiler.collectGarbage');
  const usage = (await cdp.send('Runtime.getHeapUsage')) as { usedSize: number };
  return mb(usage.usedSize);
}

function installProbes() {
  const w = window as unknown as { __perf: { fcp: number; longTasks: number[]; heapPeak: number } };
  w.__perf = { fcp: 0, longTasks: [], heapPeak: 0 };
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (e.name === 'first-contentful-paint') {
        w.__perf.fcp = e.startTime;
      }
    }
  }).observe({ type: 'paint', buffered: true });
  new PerformanceObserver((list) => list.getEntries().forEach((e) => w.__perf.longTasks.push(e.duration))).observe({ type: 'longtask' });
  setInterval(() => {
    const used = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
    w.__perf.heapPeak = Math.max(w.__perf.heapPeak, used);
  }, 250);
}

const zoomOf = (page: Page) =>
  page.evaluate(() => Number(document.querySelector('.svelte-flow[data-canvas-surface]')?.getAttribute('data-view')?.split(',')[2] ?? 1));

async function zoomTo(page: Page, at: { x: number; y: number }, target: number) {
  await page.mouse.move(at.x, at.y);
  await page.keyboard.down('Control');
  for (let i = 0; i < ZOOM_STEP_LIMIT; i++) {
    const zoom = await zoomOf(page);
    if (Math.abs(zoom - target) / target < ZOOM_TOLERANCE) {
      break;
    }
    await page.mouse.wheel(0, zoom < target ? -60 : 60);
    await page.waitForTimeout(40);
  }
  await page.keyboard.up('Control');
  await page.waitForTimeout(1500);
}

async function anchorOf(page: Page) {
  const list = await boxes(page);
  if (!list.length) {
    return { x: VIEWPORT.width / 2 - 200, y: VIEWPORT.height / 2 };
  }
  return { x: list.reduce((s, b) => s + b.x + b.w / 2, 0) / list.length, y: list.reduce((s, b) => s + b.y + b.h / 2, 0) / list.length };
}

async function oneRun(browser: Browser, state: string, config: Config, index: number, profile: boolean): Promise<Run> {
  const tag = `${config.renderer}-x${config.throttle}-${index}`;
  const context = await browser.newContext({ viewport: VIEWPORT, storageState: state });
  const page = await context.newPage();
  await page.addInitScript({ content: TSX_NAME_SHIM });
  await page.addInitScript(instrument);
  await page.addInitScript(installProbes);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: config.throttle });

  const started = Date.now();
  await page.goto(urlOf(config.query), { waitUntil: 'commit' });
  let firstNodeMs = -1;
  let firstPaintMs = -1;
  let firstBlank = 0;
  const timeline: { t: number; flat: Set<string>; all: Set<string>; seen: number }[] = [];
  let shotTaken = false;
  while (Date.now() - started < LOAD_TIMEOUT_MS + SETTLE_MS) {
    const t = Date.now() - started;
    const count = await page.locator('.svelte-flow__node').count().catch(() => 0);
    if (count > 0) {
      if (firstNodeMs < 0) {
        firstNodeMs = t;
      }
      const keep = !shotTaken ? `${OUT}/${tag}-first.png` : undefined;
      const snap = await flatNodes(page, keep);
      shotTaken = true;
      timeline.push({ t, ...snap });
      if (firstPaintMs < 0 && snap.seen > snap.flat.size) {
        firstPaintMs = t;
        firstBlank = snap.flat.size;
      }
    }
    if (t > SETTLE_MS && timeline.length) {
      break;
    }
    await page.waitForTimeout(POLL_MS);
  }

  const settled = timeline.at(-1)?.flat ?? new Set<string>();
  let fullPaintMs = -1;
  for (let i = 0; i < timeline.length; i++) {
    const window = timeline.slice(i, i + STABLE_POLLS);
    const finalSeen = timeline.at(-1)!.seen;
    const clean = window.length === STABLE_POLLS && window.every((p) => p.seen === finalSeen && [...p.flat].every((id) => settled.has(id)));
    if (clean) {
      fullPaintMs = timeline[i].t;
      break;
    }
  }
  let flashes = 0;
  timeline.forEach((p, i) => {
    const before = timeline[i - 1];
    if (!before) {
      return;
    }
    for (const id of p.flat) {
      if (!settled.has(id) && before.all.has(id) && !before.flat.has(id)) {
        flashes += 1;
      }
    }
  });

  const heapLoadMb = await heapMb(cdp);
  const fcpMs = await page.evaluate(() => (window as unknown as { __perf: { fcp: number } }).__perf.fcp);

  if (profile) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
    await cdp.send('Profiler.start');
  }
  const panFit = await measure(page, SWEEP_MS, (until) => wheelPan(page, until));
  if (profile && TRACE) {
    await browser.startTracing(page, { path: `${OUT}/${tag}-zoom.trace.json`, categories: TRACE_CATEGORIES });
  }
  const zoom = await measure(page, SWEEP_MS, (until) => wheelZoom(page, until));
  if (profile && TRACE) {
    await browser.stopTracing();
  }
  await page.screenshot({ path: `${OUT}/${tag}-after-zoom-sweep.png` });
  await page.keyboard.press('Shift+Digit1');
  await page.waitForTimeout(1500);
  await zoomTo(page, await anchorOf(page), TARGET_ZOOM);
  await page.screenshot({ path: `${OUT}/${tag}-zoomed.png` });
  if (profile && TRACE) {
    await browser.startTracing(page, { path: `${OUT}/${tag}-panZoomed.trace.json`, categories: TRACE_CATEGORIES });
  }
  const panZoomed = await measure(page, SWEEP_MS, (until) => wheelPan(page, until));
  if (profile && TRACE) {
    await browser.stopTracing();
  }
  if (profile) {
    const { profile: prof } = (await cdp.send('Profiler.stop')) as { profile: unknown };
    writeFileSync(`${OUT}/${tag}.cpuprofile`, JSON.stringify(prof));
  }

  await page.screenshot({ path: `${OUT}/${tag}-after-sweeps.png` });

  const probe = await page.evaluate(() => (window as unknown as { __perf: { longTasks: number[]; heapPeak: number } }).__perf);
  await Promise.race([context.close(), new Promise((done) => setTimeout(done, CLOSE_TIMEOUT_MS))]);

  return {
    config,
    firstNodeMs,
    firstPaintMs,
    fcpMs: Math.round(fcpMs),
    fullPaintMs,
    settledBlank: settled.size,
    blankAtFirstNode: firstBlank,
    flashes,
    heapLoadMb,
    heapPeakMb: mb(probe.heapPeak),
    panFit,
    zoom,
    panZoomed,
    longTasks: probe.longTasks.length,
    longTaskMs: Math.round(probe.longTasks.reduce((s, d) => s + d, 0))
  };
}

type Node = { functionName: string; url: string; lineNumber: number };

function topSelfTime(file: string): { fn: string; ms: number; pct: number }[] {
  const prof = JSON.parse(readFileSync(file, 'utf8')) as { nodes: { id: number; callFrame: Node }[]; samples: number[]; timeDeltas: number[] };
  const byId = new Map(prof.nodes.map((n) => [n.id, n.callFrame]));
  const self = new Map<string, number>();
  let total = 0;
  prof.samples.forEach((id, i) => {
    const f = byId.get(id)!;
    if (f.functionName === '(idle)' || f.functionName === '(program)') {
      return;
    }
    const key = `${f.functionName || '(anonymous)'} ${f.url.split('/').slice(-2).join('/')}:${f.lineNumber}`;
    const dt = (prof.timeDeltas[i] ?? 0) / 1000;
    self.set(key, (self.get(key) ?? 0) + dt);
    total += dt;
  });
  return [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, PROFILE_TOP).map(([fn, ms]) => ({ fn, ms: Math.round(ms), pct: Math.round((ms / total) * 100) }));
}

function summarise(runs: Run[]) {
  const pick = (f: (r: Run) => number) => median(runs.map(f));
  const sweep = (key: 'panFit' | 'zoom' | 'panZoomed') => ({
    fpsMedian: pick((r) => r[key].fpsAvg),
    fpsP5: pick((r) => r[key].fpsP5),
    p95Ms: pick((r) => r[key].p95),
    maxMs: pick((r) => r[key].max),
    over33: pick((r) => r[key].over33)
  });
  return {
    firstNodeMs: pick((r) => r.firstNodeMs),
    firstPaintMs: pick((r) => r.firstPaintMs),
    fcpMs: pick((r) => r.fcpMs),
    fullPaintMs: pick((r) => r.fullPaintMs),
    blankAtFirstNode: pick((r) => r.blankAtFirstNode),
    settledFlat: pick((r) => r.settledBlank),
    heapLoadMb: pick((r) => r.heapLoadMb),
    heapPeakMb: pick((r) => r.heapPeakMb),
    longTasks: pick((r) => r.longTasks),
    longTaskMs: pick((r) => r.longTaskMs),
    panFit: sweep('panFit'),
    zoom: sweep('zoom'),
    panZoomed: sweep('panZoomed')
  };
}

type Saved = { runs: Run[]; summary: ReturnType<typeof summarise>; profile: { fn: string; ms: number; pct: number }[] };

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-precise-memory-info', `--window-size=${VIEWPORT.width},${VIEWPORT.height + 120}`] });
  const state = await login(browser);

  for (const r of RENDERERS) {
    await oneRun(browser, state, { ...r, throttle: 1 }, 0, false);
  }

  for (const r of RENDERERS) {
    for (const throttle of THROTTLES) {
      const key = `${r.renderer}-x${throttle}`;
      if (existsSync(`${OUT}/cfg-${key}.json`)) {
        continue;
      }
      const config = { ...r, throttle };
      const runs: Run[] = [];
      for (let i = 1; i <= RUNS; i++) {
        runs.push(await oneRun(browser, state, config, i, false));
        console.log(`${key} run ${i} done`);
      }
      await oneRun(browser, state, config, 99, true);
      const saved: Saved = { runs, summary: summarise(runs), profile: topSelfTime(`${OUT}/${key}-99.cpuprofile`) };
      writeFileSync(`${OUT}/cfg-${key}.json`, JSON.stringify(saved, null, 2));
      console.log(`${key} saved`);
    }
  }
  await Promise.race([browser.close(), new Promise((done) => setTimeout(done, CLOSE_TIMEOUT_MS))]);

  const results: Record<string, Saved> = {};
  for (const r of RENDERERS) {
    for (const t of THROTTLES) {
      const key = `${r.renderer}-x${t}`;
      results[key] = JSON.parse(readFileSync(`${OUT}/cfg-${key}.json`, 'utf8'));
    }
  }
  const profiles = Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.profile]));
  writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, profiles, at: new Date().toISOString() }, null, 2));
  process.exit(0);
}

void main();
