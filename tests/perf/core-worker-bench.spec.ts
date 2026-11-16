import { test, chromium, type CDPSession, type Page } from '@playwright/test';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { panPath, zoomPath, type Step } from '../../scripts/perf/gestures';
import { LANDINGS_FIXTURE_PLACE } from '../../scripts/perf/landings-fixture.mjs';

enum Target {
  Heavy = 'heavy',
  Landings = 'landings'
}

enum Mode {
  Main = 'main',
  Worker = 'worker'
}

enum Gesture {
  Pan = 'pan',
  Zoom = 'zoom'
}

type Place = { projectId: string; canvasId: string };
type Probe = { x: number; zoom: number; at: number };
type Seen = { raf: number[]; presented: number[]; latency: number[]; longMs: number; longCount: number };

const PORT = Number(process.env.BENCH_PORT ?? 5288);
const OUT = process.env.BENCH_OUT ?? 'perf-results/core-worker';
const [heavyProject, heavyCanvas] = (process.env.PROBE_PLACE ?? ':').split(':');
const PLACES: Record<Target, { base: string; place: Place; login: boolean }> = {
  [Target.Heavy]: { base: `http://127.0.0.1:${PORT + 1}`, place: { projectId: heavyProject, canvasId: heavyCanvas }, login: true },
  [Target.Landings]: { base: `http://127.0.0.1:${PORT}`, place: LANDINGS_FIXTURE_PLACE, login: false }
};
const TARGETS = (process.env.BENCH_TARGETS?.split(',') ?? Object.values(Target)) as Target[];
const MODES = (process.env.BENCH_MODES?.split(',') ?? Object.values(Mode)) as Mode[];
const CPUS = (process.env.BENCH_CPUS ?? '1,4').split(',').map(Number);
const CAPS = (process.env.BENCH_CAPS ?? 'uncapped,capped').split(',');
const FLICKER_RUNS = Number(process.env.BENCH_FLICKER_RUNS ?? 9);
const VIEWPORT = { width: 1440, height: 900 };
const CENTRE = { x: 720, y: 450 };
const CTRL = 2;
const SETTLE_MS = 20_000;
const QUIET_MS = 1500;
const LEG_MS = 1500;
const EDITS = 8;
const EDIT_PAUSE_MS = 300;
const OVER_MS = 1000 / 120;
const MS_PER_S = 1000;
const UNCAPPED = ['--disable-gpu-vsync', '--disable-frame-rate-limit'];
const GRID = [12, 8] as const;

const ZOOM_LEGS = [
  { to: 1.2, ms: LEG_MS },
  { to: 0.3, ms: LEG_MS },
  { to: 2.4, ms: LEG_MS },
  { to: 0.3, ms: LEG_MS }
];
const PATHS: Record<Gesture, () => Step[]> = {
  [Gesture.Pan]: () => panPath({ legs: [{ by: { x: 0, y: 1600 }, ms: LEG_MS }, { by: { x: 0, y: -1600 }, ms: LEG_MS }, { by: { x: 1200, y: 0 }, ms: LEG_MS }], tailMs: 600, at: CENTRE }),
  [Gesture.Zoom]: () => zoomPath({ from: 0.3, anchor: CENTRE, legs: ZOOM_LEGS })
};

const at = (sorted: number[], share: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] ?? 0;
const round = (n: number) => Math.round(n * 10) / 10;

function summary(gaps: number[]) {
  const sorted = [...gaps].sort((a, b) => a - b);
  const total = gaps.reduce((a, b) => a + b, 0);
  return { n: gaps.length, fps: total ? Math.round((gaps.length * MS_PER_S) / total) : 0, p50: round(at(sorted, 0.5)), p99: round(at(sorted, 0.99)), over8: gaps.filter((g) => g > OVER_MS).length };
}

function arm() {
  const w = window as unknown as { __bench: { raf: number[]; probes: Probe[]; inputs: number[]; long: number[]; counting: boolean }; __coreProbe: (x: number, zoom: number, at: number) => void };
  w.__bench = { raf: [], probes: [], inputs: [], long: [], counting: false };
  w.__coreProbe = (x, zoom, done) => w.__bench.counting && w.__bench.probes.push({ x, zoom, at: done });
  const tick = (t: number) => (w.__bench.counting && w.__bench.raf.push(t), requestAnimationFrame(tick));
  requestAnimationFrame(tick);
  addEventListener('wheel', (e) => w.__bench.counting && w.__bench.inputs.push(e.timeStamp), { capture: true, passive: true });
  new PerformanceObserver((list) => list.getEntries().forEach((e) => w.__bench.counting && w.__bench.long.push(e.duration))).observe({ type: 'longtask', buffered: false });
}

function latencies(inputs: number[], probes: Probe[]): number[] {
  return inputs.flatMap((input) => {
    const before = probes.filter((p) => p.at <= input).at(-1);
    const after = probes.find((p) => p.at > input && (!before || p.x !== before.x || p.zoom !== before.zoom));
    return after ? [after.at - input] : [];
  });
}

async function open(target: Target, mode: Mode, capped: boolean) {
  const { base, place, login } = PLACES[target];
  const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', ...(capped ? [] : UNCAPPED)] });
  const page = await (await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, serviceWorkers: 'block' })).newPage();
  page.on('console', (m) => /core|worker/i.test(m.text()) && m.type() !== 'log' && console.log(`[page ${m.type()}] ${m.text().slice(0, 200)}`));
  page.on('pageerror', (e) => console.log(`[pageerror] ${e.message.slice(0, 200)}`));
  await page.addInitScript(arm);
  if (login) {
    await page.goto(`${base}/login`);
    await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
    await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
    await page.press('input[type=password]', 'Enter');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  }
  await page.goto(`${base}/p/${place.projectId}/c/${place.canvasId}${mode === Mode.Worker ? '?coreWorker=1' : ''}`);
  await page.waitForSelector('[data-canvas-surface]', { timeout: 120_000 });
  await page.getByRole('button', { name: 'Reject all' }).click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(SETTLE_MS);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  return { browser, page, cdp };
}

async function play(cdp: CDPSession, steps: Step[], onStart: () => void = () => {}) {
  const began = Date.now();
  onStart();
  for (const s of steps) {
    const wait = began + s.at - Date.now();
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    void cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: s.x, y: s.y, deltaX: s.dx, deltaY: s.dy, modifiers: s.ctrl ? CTRL : 0 }).catch(() => {});
  }
}

async function gesture(page: Page, cdp: CDPSession, which: Gesture): Promise<Seen> {
  await page.keyboard.press('Shift+Digit1');
  await page.waitForTimeout(QUIET_MS);
  await page.evaluate(() => Object.assign((window as unknown as { __bench: object }).__bench, { raf: [], probes: [], inputs: [], long: [], counting: true }));
  await play(cdp, PATHS[which]());
  await page.waitForTimeout(QUIET_MS);
  const got = await page.evaluate(() => {
    const b = (window as unknown as { __bench: { raf: number[]; probes: Probe[]; inputs: number[]; long: number[]; counting: boolean } }).__bench;
    b.counting = false;
    return { raf: b.raf, probes: b.probes, inputs: b.inputs, long: b.long };
  });
  const active = (t: number) => got.inputs.length > 0 && t >= got.inputs[0] && t <= got.inputs.at(-1)! + 100;
  const gapsOf = (ts: number[]) => ts.filter(active).flatMap((t, i, all) => (i ? [t - all[i - 1]] : []));
  return { raf: gapsOf(got.raf), presented: gapsOf(got.probes.map((p) => p.at)), latency: latencies(got.inputs, got.probes), longMs: round(got.long.reduce((a, b) => a + b, 0)), longCount: got.long.length };
}

async function taskSeconds(cdp: CDPSession): Promise<number> {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return metrics.find((m) => m.name === 'TaskDuration')?.value ?? 0;
}

async function editBusy(page: Page, cdp: CDPSession): Promise<number | null> {
  await page.keyboard.press('Shift+Digit1');
  await page.waitForTimeout(QUIET_MS);
  const nodes = await page.locator('[data-testid="gpu-node"]').evaluateAll((all) => all.map((n) => n.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height })));
  const big = nodes.filter((b) => b.x > 100 && b.y > 100 && b.x + b.w < 1340 && b.y + b.h < 800).sort((a, b) => b.w * b.h - a.w * a.h)[0];
  if (!big) {
    return null;
  }
  await page.mouse.click(big.x + big.w * 0.3, big.y + big.h * 0.3);
  const picked = await page.getByTestId('frame-selection').first().waitFor({ timeout: 5000 }).then(() => true, () => false);
  if (!picked) {
    return null;
  }
  const before = await taskSeconds(cdp);
  for (let i = 0; i < EDITS; i++) {
    await page.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowRight');
    await page.waitForTimeout(EDIT_PAUSE_MS);
  }
  const busy = ((await taskSeconds(cdp)) - before) * MS_PER_S;
  await page.keyboard.press('Escape');
  return round(busy / EDITS);
}

async function cells(jpeg: Buffer): Promise<number[]> {
  const [gw, gh] = GRID;
  const { data, info } = await sharp(jpeg).resize(gw * 10, gh * 10).raw().toBuffer({ resolveWithObject: true });
  const bg = [data[0], data[1], data[2]];
  const out = new Array(gw * gh).fill(0);
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      const ink = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 24;
      out[Math.floor(y / 10) * gw + Math.floor(x / 10)] += ink ? 1 / 100 : 0;
    }
  }
  return out;
}

const vanished = (a: number[], b: number[], c: number[]) => b.some((v, i) => Math.min(a[i], c[i]) > 0.3 && v < 0.4 * Math.min(a[i], c[i]));

async function flickerDips(page: Page, cdp: CDPSession): Promise<number> {
  await page.keyboard.press('Shift+Digit1');
  await page.waitForTimeout(QUIET_MS);
  const frames: Buffer[] = [];
  const onFrame = (f: { data: string; sessionId: number }) => {
    frames.push(Buffer.from(f.data, 'base64'));
    void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  };
  cdp.on('Page.screencastFrame', onFrame);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 40, maxWidth: 720, maxHeight: 450, everyNthFrame: 1 });
  await play(cdp, PATHS[Gesture.Zoom]());
  await page.waitForTimeout(QUIET_MS);
  await cdp.send('Page.stopScreencast');
  cdp.off('Page.screencastFrame', onFrame);
  const grid = await Promise.all(frames.map(cells));
  return grid.filter((g, i) => i > 0 && i < grid.length - 1 && vanished(grid[i - 1], g, grid[i + 1])).length;
}

const LOG = join(OUT, 'results.jsonl');

for (const target of TARGETS) {
  for (const mode of MODES) {
    for (const cap of CAPS) {
      test(`${target} ${mode} ${cap}`, async () => {
        test.setTimeout(1_800_000);
        mkdirSync(OUT, { recursive: true });
        const { browser, page, cdp } = await open(target, mode, cap === 'capped');
        const backend = await page.locator('[data-testid="core-canvas"]').count();
        for (const cpu of CPUS) {
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
          const row: Record<string, unknown> = { target, mode, cap, cpu, canvases: backend };
          for (const which of Object.values(Gesture)) {
            const seen = await gesture(page, cdp, which);
            row[which] = { raf: summary(seen.raf), presented: summary(seen.presented), latency: summary(seen.latency), longMs: seen.longMs, longCount: seen.longCount };
          }
          row.editBusyMs = await editBusy(page, cdp).catch(() => null);
          console.log(JSON.stringify(row));
          appendFileSync(LOG, JSON.stringify(row) + '\n');
        }
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        if (cap === 'capped' && target === Target.Heavy && FLICKER_RUNS > 0) {
          const dips: number[] = [];
          for (let i = 0; i < FLICKER_RUNS; i++) {
            dips.push(await flickerDips(page, cdp));
          }
          console.log(`flicker ${target} ${mode}: ${dips.join(',')}`);
          appendFileSync(LOG, JSON.stringify({ target, mode, flicker: dips }) + '\n');
        }
        await page.screenshot({ path: join(OUT, `${target}-${mode}-${cap}.png`) });
        writeFileSync(join(OUT, 'last.txt'), `${target} ${mode} ${cap}`);
        await browser.close();
      });
    }
  }
}
