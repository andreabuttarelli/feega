import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { test, chromium, webkit, type Browser, type Page } from '@playwright/test';
import sharp from 'sharp';
import { instrument, measure, wheelPan, wheelZoom, type Frames } from './fixtures/frame-sweeps';

const FIXTURE = process.env.HEAVY_FIXTURE;
const OUT = process.env.CANVAS_BENCH_OUT ?? join(homedir(), 'Documents', 'feega-videos', 'perf', 'tile-pyramid');
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_MS = 12_000;
const GESTURE_MS = 4000;
const SAMPLE_MS = 250;
const SHARP_POLL_MS = 60;
const SHARP_GIVE_UP_MS = 15_000;
const BURST_STEPS = 12;
const MB = 1024 * 1024;
const KB_PER_MB = 1024;
const CHANNEL_TOLERANCE = 2;
const DEEP_BURSTS = 3;

enum Mode {
  Retained = 'retained',
  Tiles = 'tiles'
}

const QUERY: Record<Mode, string> = { [Mode.Retained]: '', [Mode.Tiles]: '?tiles=1' };

type Row = { browser: string; cpu: number; mode: Mode; pan: Frames; zoom: Frames; deep: Frames; sharpMs: number; textureMb: number | null; gpuProcessPeakMb: number | null };

const webkitGpuPids = (): Set<string> =>
  new Set(
    execSync('ps -axo pid=,comm=')
      .toString()
      .split('\n')
      .filter((l) => /WebKit\.GPU/.test(l))
      .map((l) => l.trim().split(/\s+/)[0])
  );

const rssMb = (pids: Set<string>): number =>
  Math.round(
    execSync('ps -axo pid=,rss=')
      .toString()
      .split('\n')
      .map((l) => l.trim().split(/\s+/))
      .filter(([pid]) => pids.has(pid))
      .reduce((sum, [, kb]) => sum + Number(kb) / KB_PER_MB, 0)
  );

async function login(page: Page, base: string) {
  await page.goto(`${base}/login`);
  await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
  await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
  await page.press('input[type=password]', 'Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

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

async function fit(page: Page) {
  await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height - 40);
  await page.keyboard.press('Shift+1');
  await page.waitForTimeout(SETTLE_MS);
}

async function burst(page: Page) {
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
  await page.keyboard.down('Control');
  for (let i = 0; i < BURST_STEPS; i++) {
    await page.mouse.wheel(0, -60);
  }
  await page.keyboard.up('Control');
}

async function run(browser: Browser, name: string, cpu: number, mode: Mode, base: string, path: string, gpuPids: () => Set<string>): Promise<Row> {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await context.newPage();
  await login(page, base);
  await page.addInitScript(instrument);
  await page.addInitScript(() => {
    const peaks = { bytes: 0 };
    (window as unknown as { __peaks: typeof peaks }).__peaks = peaks;
    setInterval(() => {
      const probe = (window as unknown as Record<symbol, { textureBytes: number } | undefined>)[Symbol.for('feega.gpu-probe')];
      peaks.bytes = Math.max(peaks.bytes, probe?.textureBytes ?? 0);
    }, 100);
  });
  if (cpu > 1 && name === 'chromium') {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  }
  let peak = 0;
  const pids = gpuPids();
  const sampler = setInterval(() => (peak = Math.max(peak, rssMb(pids))), SAMPLE_MS);

  await page.goto(`${base}${path}${QUERY[mode]}`, { waitUntil: 'commit' });
  await page.getByRole('button', { name: 'Reject all' }).click({ timeout: 8000 }).catch(() => {});
  await page.locator('[data-canvas-surface]').first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(SETTLE_MS);
  await fit(page);
  const tag = `${name}-cpu${cpu}-${mode}`;
  writeFileSync(join(OUT, `${tag}-settled.png`), await shot(page));

  const pan = await measure(page, GESTURE_MS, (until) => wheelPan(page, until));
  const zoom = await measure(page, GESTURE_MS, (until) => wheelZoom(page, until));

  for (let i = 0; i < DEEP_BURSTS; i++) {
    await burst(page);
  }
  await page.waitForTimeout(SETTLE_MS);
  writeFileSync(join(OUT, `${tag}-deep-settled.png`), await shot(page));
  const deep = await measure(page, GESTURE_MS, (until) => wheelZoom(page, until));

  await fit(page);
  await burst(page);
  writeFileSync(join(OUT, `${tag}-midzoom.png`), await shot(page));
  const sharpMs = await untilSharp(page);
  writeFileSync(join(OUT, `${tag}-zoomed-settled.png`), await shot(page));

  const textureBytes = await page.evaluate(() => (window as unknown as { __peaks: { bytes: number } }).__peaks.bytes);
  clearInterval(sampler);
  await context.close();
  return { browser: name, cpu, mode, pan, zoom, deep, sharpMs, textureMb: textureBytes ? Math.round(textureBytes / MB) : null, gpuProcessPeakMb: pids.size ? peak : null };
}

async function differing(a: string, b: string): Promise<number> {
  const [x, y] = await Promise.all([a, b].map((f) => sharp(f).ensureAlpha().raw().toBuffer()));
  if (x.length !== y.length) {
    return 1;
  }
  let off = 0;
  for (let i = 0; i < x.length; i += 4) {
    if ([0, 1, 2, 3].some((c) => Math.abs(x[i + c] - y[i + c]) > CHANNEL_TOLERANCE)) {
      off += 1;
    }
  }
  return off / (x.length / 4);
}

const row = (r: Row) =>
  `| ${r.browser} | ${r.cpu === 1 ? 'desktop' : `${r.cpu}x`} | ${r.mode} | ${r.zoom.fpsAvg} | ${r.deep.fpsAvg} | ${r.pan.fpsAvg} | ${Math.max(r.zoom.max, r.pan.max)} | ${r.deep.max} | ${r.zoom.p95} | ${r.sharpMs} | ${r.textureMb ?? 'n/a'} | ${r.gpuProcessPeakMb ?? 'n/a'} |`;

test.describe('tile pyramid vs retained @real', () => {
  test.skip(!FIXTURE || !process.env.E2E_TEST_EMAIL, 'needs HEAVY_FIXTURE and the test account');
  test.setTimeout(1_800_000);

  test('measures both raster modes on the heavy canvas', async ({ baseURL }) => {
    mkdirSync(OUT, { recursive: true });
    const fixture = JSON.parse(readFileSync(FIXTURE!, 'utf8')) as { projectId: string; canvasId: string };
    const path = `/p/${fixture.projectId}/c/${fixture.canvasId}`;
    const engines = (process.env.PROBE_ENGINES ?? 'chromium,webkit').split(',');
    const rows: Row[] = [];
    for (const mode of [Mode.Retained, Mode.Tiles]) {
      if (engines.includes('chromium')) {
        const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu', '--enable-precise-memory-info'] });
        for (const cpu of [1, 4]) {
          rows.push(await run(browser, 'chromium', cpu, mode, baseURL!, path, () => new Set()));
        }
        await browser.close();
      }
      if (engines.includes('webkit')) {
        const before = webkitGpuPids();
        const browser = await webkit.launch({ headless: false });
        rows.push(await run(browser, 'webkit', 1, mode, baseURL!, path, () => new Set([...webkitGpuPids()].filter((p) => !before.has(p)))));
        await browser.close();
      }
    }
    const diffs: string[] = [];
    for (const r of rows.filter((r) => r.mode === Mode.Retained)) {
      const tag = `${r.browser}-cpu${r.cpu}`;
      for (const view of ['settled', 'deep-settled', 'zoomed-settled']) {
        const share = await differing(join(OUT, `${tag}-retained-${view}.png`), join(OUT, `${tag}-tiles-${view}.png`));
        diffs.push(`| ${tag} | ${view} | ${(share * 100).toFixed(3)}% |`);
      }
    }
    const head = '| engine | CPU | mode | zoom fps | zoomed-in zoom fps | pan fps | worst frame ms | zoomed-in worst ms | zoom p95 ms | time-to-sharp ms | texture peak MB | WebKit GPU proc peak MB |\n|---|---|---|---|---|---|---|---|---|---|---|---|';
    const text = [head, ...rows.map(row), '', '| run | view | pixels off |\n|---|---|---|', ...diffs].join('\n');
    writeFileSync(join(OUT, `${process.env.PROBE_LABEL ?? 'run'}.md`), text);
    writeFileSync(join(OUT, `${process.env.PROBE_LABEL ?? 'run'}.json`), JSON.stringify(rows, null, 2));
    console.log(text);
  });
});
