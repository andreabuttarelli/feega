import { test, chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { zoomPath } from '../../scripts/perf/gestures';
import { inkOf, vanishes } from '../../scripts/perf/flicker';

const BASE = `http://127.0.0.1:${Number(process.env.BENCH_PORT ?? 5288) + 1}`;
const OUT = process.env.PROBE_OUT ?? 'perf-results/flicker';
const MODE = process.env.PROBE_MODE ?? 'flicker';
const [WIDTH, HEIGHT] = (process.env.PROBE_VIEWPORT ?? '1440x900').split('x').map(Number);
const DPR = Number(process.env.PROBE_DPR ?? 1);
const CENTRE = { x: WIDTH / 2, y: HEIGHT / 2 };
const LEG_MS = 1500;
const CTRL = 2;
const GRID = [12, 8] as const;
const PAUSE_AT_MS = [1000, 3900, 5200];
const SETTLE_MS = 3000;
const MS_PER_S = 1000;
const TRACE_TOP = 30;

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

const INK_SIZE = { width: 180, height: 112 };

async function ink(jpeg: Buffer) {
  const { data, info } = await sharp(jpeg).resize(INK_SIZE.width, INK_SIZE.height).raw().toBuffer({ resolveWithObject: true });
  return inkOf(new Uint8Array(data), info.width, info.height, info.channels);
}

const dipped = (a: number[], b: number[], c: number[]) => b.some((v, i) => Math.min(a[i], c[i]) > 0.3 && v < 0.4 * Math.min(a[i], c[i]));

test('direct zoom on the user canvas copy', async () => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', ...(process.env.PROBE_UNCAPPED === '1' ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : [])] });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: DPR });
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
  await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  await page.goto(`${BASE}/p/${process.env.PROBE_PROJECT}/c/${process.env.PROBE_CANVAS}${process.env.PROBE_QUERY ?? ''}`);
  await page.waitForSelector('[data-canvas-surface]', { timeout: 120_000 });
  await page.getByRole('button', { name: 'Reject all' }).click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(20_000);
  if (process.env.PROBE_SELECT_ALL === '1') {
    await page.mouse.click(CENTRE.x, CENTRE.y);
    await page.keyboard.press('ControlOrMeta+a');
    await page.waitForTimeout(SETTLE_MS);
  }

  const logged: string[] = [];
  page.on('console', (m) => m.text().startsWith('DBG') && logged.push(m.text()));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.PROBE_CPU ?? 1) });
  await page.evaluate(() => {
    const w = window as unknown as { __t: number[] };
    w.__t = [];
    const tick = (t: number) => (w.__t.push(t), requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  });
  const frames: { at: number; data: Buffer }[] = [];
  let began = 0;
  cdp.on('Page.screencastFrame', (f: { data: string; sessionId: number }) => {
    frames.push({ at: Date.now() - began, data: Buffer.from(f.data, 'base64') });
    void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  const casting = MODE !== 'smooth';
  if (casting) {
    const fine = MODE === 'sharp' || MODE === 'video';
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: fine ? 90 : 40, maxWidth: fine ? 1440 : 720, maxHeight: fine ? 900 : 450, everyNthFrame: 1 });
  }
  const moderate = process.env.PROBE_MODERATE === '1';
  const legs = moderate ? [{ to: 1.5, ms: LEG_MS }, { to: 0.5, ms: LEG_MS }, { to: 1.5, ms: LEG_MS }, { to: 0.5, ms: LEG_MS }] : [{ to: 1.2, ms: LEG_MS }, { to: 0.3, ms: LEG_MS }, { to: 2.4, ms: LEG_MS }, { to: 0.3, ms: LEG_MS }];
  const steps = zoomPath({ from: moderate ? 0.5 : 0.3, anchor: CENTRE, legs });
  const profiled = process.env.PROBE_PROFILE === '1';
  type Traced = { name: string; dur?: number; ph: string; args?: { elementCount?: number; beginData?: { elementCount?: number }; data?: { nodeName?: string; reason?: string; invalidatedSelectors?: string[]; changedClass?: string; changedAttribute?: string; changedId?: string; changedPseudo?: string; extraData?: string } } };
  const traced: Traced[] = [];
  const tracing = process.env.PROBE_TRACE === '1';
  if (tracing) {
    cdp.on('Tracing.dataCollected', (e) => traced.push(...(e.value as unknown as Traced[])));
    await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.invalidationTracking', transferMode: 'ReportEvents' });
  }
  if (profiled) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
    await cdp.send('Profiler.start');
  }
  const startT = await page.evaluate(() => performance.now());
  began = Date.now();
  const pauses = MODE === 'sharp' ? [...PAUSE_AT_MS] : [];
  let paused = 0;
  for (const s of steps) {
    if (pauses.length && s.at >= pauses[0]) {
      const moment = pauses.shift()!;
      const moving = frames.at(-1)!;
      const pausedFor = Date.now();
      await page.waitForTimeout(SETTLE_MS);
      writeFileSync(`${OUT}/moment-${moment}-moving.jpg`, moving.data);
      writeFileSync(`${OUT}/moment-${moment}-settled.jpg`, frames.at(-1)!.data);
      paused += Date.now() - pausedFor;
    }
    const wait = began + paused + s.at - Date.now();
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    void cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: s.x, y: s.y, deltaX: s.dx, deltaY: s.dy, modifiers: s.ctrl ? CTRL : 0 }).catch(() => {});
  }
  await page.waitForTimeout(2000);
  if (tracing) {
    const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
    await cdp.send('Tracing.end');
    await done;
    const sums = new Map<string, number>();
    for (const e of traced.filter((t) => t.ph === 'X' && t.dur)) {
      sums.set(e.name, (sums.get(e.name) ?? 0) + e.dur! / MS_PER_S);
    }
    const styled = traced.filter((t) => t.name === 'UpdateLayoutTree' && t.ph === 'X').map((t) => t.args?.elementCount ?? t.args?.beginData?.elementCount ?? 0);
    console.log(`styles n=${styled.length} elements mean=${(styled.reduce((a, b) => a + b, 0) / Math.max(1, styled.length)).toFixed(0)}`);
    const why = new Map<string, number>();
    for (const t of traced.filter((e) => e.name.endsWith('InvalidationTracking'))) {
      const d = t.args?.data ?? {};
      const key = `${t.name} ${d.nodeName ?? ''} ${d.reason ?? ''} ${d.changedClass ?? d.changedAttribute ?? d.changedId ?? d.changedPseudo ?? ''} ${(d.invalidatedSelectors ?? []).slice(0, 2).join('|')}`;
      why.set(key, (why.get(key) ?? 0) + 1);
    }
    writeFileSync(`${OUT}/invalidations.txt`, [...why].sort((a, b) => b[1] - a[1]).slice(0, TRACE_TOP).map(([k, v]) => `${v}\t${k}`).join('\n'));
    writeFileSync(`${OUT}/trace.txt`, [...sums].sort((a, b) => b[1] - a[1]).slice(0, TRACE_TOP).map(([k, v]) => `${v.toFixed(0)}\t${k}`).join('\n'));
  }
  if (profiled) {
    const { profile } = (await cdp.send('Profiler.stop')) as { profile: { nodes: { id: number; callFrame: { functionName: string; url: string; lineNumber: number } }[]; samples: number[] } };
    const byId = new Map(profile.nodes.map((n) => [n.id, n.callFrame]));
    const counts = new Map<string, number>();
    for (const id of profile.samples) {
      const f = byId.get(id)!;
      const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 25);
    writeFileSync(`${OUT}/profile.txt`, top.map(([k, v]) => `${v}\t${k}`).join('\n'));
  }
  const t = await page.evaluate((from) => (window as unknown as { __t: number[] }).__t.filter((x) => x >= from), startT);
  const gaps = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b);
  console.log(`frames fps=${Math.round((gaps.length * 1000) / (t.at(-1)! - t[0]))} p95=${gaps[Math.floor(gaps.length * 0.95)].toFixed(1)} worst=${gaps.at(-1)!.toFixed(0)} mean=${(gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(2)} over50=${gaps.filter((g) => g > 50).length} over8=${gaps.filter((g) => g > 8.3).length} n=${gaps.length}`);
  const core = await page.evaluate(() => {
    const f = ((window as unknown as { __gpuCanvas?: { frames?: { ms: number; moving: boolean; bakes: number; bakeMs: number; plans: number; tiles: number; unsharp: number }[] } }).__gpuCanvas?.frames ?? []).filter((x) => x.moving);
    const sorted = (k: 'ms' | 'bakeMs') => f.map((x) => x[k]).sort((a, b) => a - b);
    const p = (a: number[], q: number) => +(a[Math.floor(a.length * q)] ?? 0).toFixed(2);
    const per = (k: 'bakes' | 'plans' | 'tiles' | 'unsharp') => +(f.reduce((n, x) => n + x[k], 0) / Math.max(1, f.length)).toFixed(2);
    return { n: f.length, ms50: p(sorted('ms'), 0.5), ms95: p(sorted('ms'), 0.95), msMax: p(sorted('ms'), 0.999), bake50: p(sorted('bakeMs'), 0.5), bake95: p(sorted('bakeMs'), 0.95), bakes: per('bakes'), plans: per('plans'), tiles: per('tiles'), unsharp: per('unsharp') };
  });
  console.log(`core ${JSON.stringify(core)}`);
  console.log(`canvasdata ${JSON.stringify(await page.evaluate(() => ({ ...(document.querySelector('[data-testid=core-canvas]') as HTMLElement | null)?.dataset })))}`);
  if (casting) {
    await cdp.send('Page.stopScreencast');
  }

  if (MODE === 'flicker') {
    const grid = await Promise.all(frames.map((f) => cells(f.data)));
    const vanishedAt = async (i: number) => {
      const [a, b, c] = await Promise.all([i - 1, i, i + 1].map((j) => ink(frames[j].data)));
      return vanishes(a, b, c);
    };
    const dips: number[] = [];
    for (let i = 1; i < grid.length - 1; i++) {
      if (dipped(grid[i - 1], grid[i], grid[i + 1]) && (await vanishedAt(i))) {
        dips.push(i);
      }
    }
    dips.forEach((i) => [i - 1, i, i + 1].forEach((j) => writeFileSync(`${OUT}/dip-${i}-${j}.jpg`, frames[j].data)));
    writeFileSync(`${OUT}/console.txt`, [`start=${startT.toFixed(0)}`, ...dips.map((i) => `dip ${i} at=${frames[i].at} prev=${frames[i - 1].at} next=${frames[i + 1].at}`), ...logged].join('\n'));
    console.log(`flicker frames=${frames.length} dips=${dips.length} at=${dips.slice(0, 20).join(',')}`);
  }
  if (MODE === 'video') {
    frames.forEach((f, i) => writeFileSync(`${OUT}/f-${String(i).padStart(4, '0')}-${f.at}.jpg`, f.data));
    console.log(`video frames=${frames.length}`);
  }
  await browser.close();
});
