import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, expect, test, type Page } from '@playwright/test';

const RUNS = Number(process.env.BENCH_RUNS ?? 3);
const CPU = Number(process.env.BENCH_CPU ?? 1);
const OUT = process.env.BENCH_OUT ?? 'perf-results';
const BASE = `http://127.0.0.1:${Number(process.env.BENCH_PORT ?? 5391) + 1}`;
const [PROJECT, CANVAS] = (process.env.PROBE_PLACE ?? '').split(':');
const SHARP_GIVE_UP_MS = 60_000;
const QUIET_MS = 3000;
const UNCAPPED = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'];
const MB = 1024 * 1024;

type Loaded = { firstFrameMs: number | null; sharpMs: number | null; wireMb: Record<string, number>; heapMb: number; wasmMb: number };

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
  await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
  await page.press('input[type=password]', 'Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

async function load(page: Page): Promise<Loaded> {
  const started = Date.now();
  await page.goto(`${BASE}/p/${PROJECT}/c/${CANVAS}?coreDebug`, { waitUntil: 'commit' });
  await page.waitForFunction(() => performance.getEntriesByName('frame|sharp|all').length > 0, null, { timeout: SHARP_GIVE_UP_MS }).catch(() => null);
  await page.waitForTimeout(QUIET_MS);
  const seen = await page.evaluate(() => {
    const marks = performance.getEntriesByType('mark');
    const first = marks.find((m) => m.name.startsWith('frame|drawn|'));
    const sharp = marks.find((m) => m.name === 'frame|sharp|all');
    const mem = (window as Window & { __gpuMem?: { wasmBytes?: number; wire?: Record<string, number> } }).__gpuMem;
    const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
    return { first: first?.startTime ?? null, sharp: sharp?.startTime ?? null, wasm: mem?.wasmBytes ?? 0, wire: mem?.wire ?? {}, heap };
  });
  console.log(`loaded in ${Date.now() - started} ms`);
  return { firstFrameMs: seen.first, sharpMs: seen.sharp, heapMb: seen.heap / MB, wasmMb: seen.wasm / MB, wireMb: Object.fromEntries(Object.entries(seen.wire).map(([k, v]) => [k, v / MB])) };
}

test('the user canvas copy loads', async () => {
  test.setTimeout(RUNS * 120_000);
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: false, args: UNCAPPED });
  const runs: Loaded[] = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await login(page);
  for (let i = 0; i < RUNS; i++) {
    const fresh = await context.newPage();
    const cdp = await context.newCDPSession(fresh);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    runs.push(await load(fresh));
    await fresh.close();
  }
  await browser.close();
  writeFileSync(join(OUT, `heavy-load-${CPU}x.json`), JSON.stringify(runs, null, 2));
  console.log(JSON.stringify(runs));
  expect(runs.length).toBe(RUNS);
});
