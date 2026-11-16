import { test, chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { zoomPath } from '../../scripts/perf/gestures';

const BASE = `http://127.0.0.1:${Number(process.env.BENCH_PORT ?? 5288) + 1}`;
const OUT = process.env.PROBE_OUT ?? 'perf-results/flicker';
const MODE = process.env.PROBE_MODE ?? 'flicker';
const CENTRE = { x: 720, y: 450 };
const LEG_MS = 1500;
const CTRL = 2;
const GRID = [12, 8] as const;
const PAUSE_AT_MS = [1000, 3900, 5200];
const SETTLE_MS = 3000;

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

test('direct zoom on the user canvas copy', async () => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', ...(process.env.PROBE_UNCAPPED === '1' ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : [])] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
  await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  await page.goto(`${BASE}/p/${process.env.PROBE_PROJECT}/c/${process.env.PROBE_CANVAS}${process.env.PROBE_QUERY ?? ''}`);
  await page.waitForSelector('[data-canvas-surface]', { timeout: 120_000 });
  await page.getByRole('button', { name: 'Reject all' }).click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(20_000);

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
  const long = t.slice(1).map((x, i) => [x - t[i], t[i] - t[0]]).filter(([g]) => g > 50).map(([g, at]) => `${g.toFixed(0)}@${at.toFixed(0)}`);
  const slowCore = await page.evaluate((from) => ((window as unknown as { __gpuCanvas?: { frames?: { at: number; ms: number; moving: boolean; bakes: number }[] } }).__gpuCanvas?.frames ?? []).filter((f) => f.ms > 30).map((f) => `${f.ms.toFixed(0)}@${(f.at - from).toFixed(0)}${f.moving ? 'm' : 's'}`), t[0]);
  console.log(`longgaps ${long.join(' ')} slowcore ${slowCore.join(' ')}`);
  console.log(`canvasdata ${JSON.stringify(await page.evaluate(() => ({ ...(document.querySelector('[data-testid=core-canvas]') as HTMLElement | null)?.dataset })))}`);
  if (casting) {
    await cdp.send('Page.stopScreencast');
  }

  if (MODE === 'flicker') {
    const grid = await Promise.all(frames.map((f) => cells(f.data)));
    const dips: number[] = [];
    for (let i = 1; i < grid.length - 1; i++) {
      if (vanished(grid[i - 1], grid[i], grid[i + 1])) {
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
