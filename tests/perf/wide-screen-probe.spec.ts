import { test, expect, chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { zoomPath } from '../../scripts/perf/gestures';
import { inkOf, vanishes } from '../../scripts/perf/flicker';

const BASE = `http://127.0.0.1:${Number(process.env.BENCH_PORT ?? 5288) + 1}`;
const OUT = process.env.PROBE_OUT ?? 'perf-results/wide-screen';
const [PROJECT, CANVAS] = (process.env.PROBE_PLACE ?? '502b4c7d-3ab2-4a52-bebc-e3cce4465c45:9685d44d-6bb3-4d1f-9152-075aee712129').split(':');
const [WIDTH, HEIGHT] = (process.env.PROBE_VIEWPORT ?? '2200x1100').split('x').map(Number);
const DPR = Number(process.env.PROBE_DPR ?? 2);
const RUNS = Number(process.env.PROBE_RUNS ?? 9);
const LEG_MS = 1500;
const CTRL = 2;
const SETTLE_MS = 20_000;
const INK_SIZE = { width: 180, height: 112 };
const LOST = /gpu lost/;
const PANIC = /panic/i;
const UNCOVERED_FRAMES_MAX = 2;

type Counted = { moving: boolean; uncovered: number };

function longestBareAfterStop(frames: Counted[]): number {
  const stopped = frames.slice(frames.findLastIndex((f) => f.moving) + 1);
  let run = 0;
  let longest = 0;
  for (const f of stopped) {
    run = f.uncovered > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
}

const GRID = [12, 8] as const;
const GRID_CELL_PX = 10;

async function cells(jpeg: Buffer): Promise<number[]> {
  const [gw, gh] = GRID;
  const { data, info } = await sharp(jpeg).resize(gw * GRID_CELL_PX, gh * GRID_CELL_PX).raw().toBuffer({ resolveWithObject: true });
  const bg = [data[0], data[1], data[2]];
  const out = new Array(gw * gh).fill(0);
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      const inked = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 24;
      out[Math.floor(y / GRID_CELL_PX) * gw + Math.floor(x / GRID_CELL_PX)] += inked ? 1 / GRID_CELL_PX ** 2 : 0;
    }
  }
  return out;
}

const dipped = (a: number[], b: number[], c: number[]) => b.some((v, i) => Math.min(a[i], c[i]) > 0.3 && v < 0.4 * Math.min(a[i], c[i]));

async function ink(jpeg: Buffer) {
  const { data, info } = await sharp(jpeg).resize(INK_SIZE.width, INK_SIZE.height).raw().toBuffer({ resolveWithObject: true });
  return inkOf(new Uint8Array(data), info.width, info.height, info.channels);
}

test(`wide screen ${WIDTH}x${HEIGHT}@${DPR}: no gpu loss, no panic, no vanish`, async () => {
  test.setTimeout(3_600_000);
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: DPR });
  const logged: string[] = [];
  page.on('console', (m) => logged.push(m.text()));
  page.on('pageerror', (e) => logged.push(`pageerror ${e.message}`));
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
  await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  await page.goto(`${BASE}/p/${PROJECT}/c/${CANVAS}`);
  await page.waitForSelector('[data-canvas-surface]', { timeout: 120_000 });
  await page.getByRole('button', { name: 'Reject all' }).click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(SETTLE_MS);

  const cdp = await page.context().newCDPSession(page);
  const centre = { x: WIDTH / 2, y: HEIGHT / 2 };
  let vanished = 0;
  const bare: number[] = [];
  for (let run = 0; run < RUNS; run++) {
    await page.evaluate(() => {
      const stats = (window as unknown as { __gpuCanvas?: { frames?: unknown[] } }).__gpuCanvas;
      if (stats) {
        stats.frames = [];
      }
    });
    const frames: Buffer[] = [];
    const shotAt: number[] = [];
    const take = (f: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
      frames.push(Buffer.from(f.data, 'base64'));
      shotAt.push((f.metadata.timestamp ?? 0) * 1000);
      void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    };
    cdp.on('Page.screencastFrame', take);
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 40, maxWidth: 720, maxHeight: 450, everyNthFrame: 1 });
    const steps = zoomPath({ from: 0.3, anchor: centre, legs: [{ to: 1.2, ms: LEG_MS }, { to: 0.3, ms: LEG_MS }, { to: 2.4, ms: LEG_MS }, { to: 0.3, ms: LEG_MS }] });
    const began = Date.now();
    for (const s of steps) {
      const wait = began + s.at - Date.now();
      if (wait > 0) {
        await new Promise((r) => setTimeout(r, wait));
      }
      void cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: s.x, y: s.y, deltaX: s.dx, deltaY: s.dy, modifiers: s.ctrl ? CTRL : 0 }).catch(() => {});
    }
    await page.waitForTimeout(1500);
    const core = await page.evaluate(() => ((window as unknown as { __gpuCanvas?: { frames?: (Counted & { at: number })[] } }).__gpuCanvas?.frames ?? []).map((f) => ({ ...f, wall: performance.timeOrigin + f.at })));
    bare.push(longestBareAfterStop(core));
    await cdp.send('Page.stopScreencast');
    cdp.off('Page.screencastFrame', take);
    const grid = await Promise.all(frames.map(cells));
    for (let i = 1; i < grid.length - 1; i++) {
      if (!dipped(grid[i - 1], grid[i], grid[i + 1])) {
        continue;
      }
      const [a, b, c] = await Promise.all([i - 1, i, i + 1].map((j) => ink(frames[j])));
      if (vanishes(a, b, c)) {
        vanished++;
        [i - 1, i, i + 1].forEach((j) => writeFileSync(`${OUT}/run${run}-vanish-${i}-${j}.jpg`, frames[j]));
        const near = core.filter((c) => Math.abs(c.wall - shotAt[i]) < 120).map((c) => ({ ...c, dt: Math.round(c.wall - shotAt[i]) }));
        writeFileSync(`${OUT}/run${run}-vanish-${i}.json`, JSON.stringify(near, null, 1));
      }
    }
  }

  const presented = await page.evaluate(() => (window as unknown as { __gpuCanvas?: { frames?: unknown[] } }).__gpuCanvas?.frames?.length ?? 0);
  const worstBare = Math.max(0, ...bare);
  const backend = await page.evaluate(() => (document.querySelector('[data-testid=core-canvas]') as HTMLElement | null)?.dataset.backend ?? 'unknown');
  const losses = logged.filter((l) => LOST.test(l));
  const panics = logged.filter((l) => PANIC.test(l));
  writeFileSync(`${OUT}/console-${WIDTH}x${HEIGHT}.txt`, logged.join('\n'));
  console.log(`wide ${WIDTH}x${HEIGHT}@${DPR} backend=${backend} lost=${losses.length} panics=${panics.length} presented=${presented} vanished=${vanished} bareAfterStop=${bare.join(',')}`);
  losses.concat(panics).slice(0, 5).forEach((l) => console.log(`  ${l.slice(0, 300)}`));
  await browser.close();

  expect(losses).toEqual([]);
  expect(panics).toEqual([]);
  expect(presented).toBeGreaterThan(0);
  expect(vanished).toBe(0);
  expect(worstBare).toBeLessThanOrEqual(UNCOVERED_FRAMES_MAX);
});
