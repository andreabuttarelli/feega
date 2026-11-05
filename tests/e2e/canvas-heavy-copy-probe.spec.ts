import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { test, chromium, webkit, type Browser, type Page } from '@playwright/test';
import { instrument, measure, wheelPan, wheelZoom, type Frames } from './fixtures/frame-sweeps';

const FIXTURE = process.env.HEAVY_FIXTURE;
const OUT = process.env.CANVAS_BENCH_OUT ?? join(homedir(), 'Documents', 'feega-videos', 'perf', 'heavy-2a05');
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_MS = 12_000;
const GESTURE_MS = 4000;
const SAMPLE_MS = 250;
const MB = 1024 * 1024;
const KB_PER_MB = 1024;

type Probe = { created?: number | null; lagMs?: number | null; browser: string; cpu: number; openMs: number; pan: Frames; zoom: Frames; heapMb: number | null; textureMb: number | null; textures: number | null; gpuProcessPeakMb: number | null; dom: number; longTasks: number };

const webkitGpuPids = (): Set<string> =>
  new Set(
    execSync('ps -axo pid=,comm=')
      .toString()
      .split('\n')
      .filter((l) => /WebKit\.GPU/.test(l))
      .map((l) => l.trim().split(/\s+/)[0])
  );

const rssMb = (pids: Set<string>): number => {
  let total = 0;
  for (const line of execSync('ps -axo pid=,rss=').toString().split('\n')) {
    const [pid, kb] = line.trim().split(/\s+/);
    if (pids.has(pid)) {
      total += Number(kb) / KB_PER_MB;
    }
  }
  return Math.round(total);
};

async function login(page: Page, base: string) {
  await page.goto(`${base}/login`);
  await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
  await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
  await page.press('input[type=password]', 'Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

async function snapshot(page: Page) {
  return page.evaluate((mb) => {
    const w = window as unknown as { __gpuCanvas?: { textures?: () => { count: number; bytes: number } }; __longTasks?: number };
    const probe = (window as unknown as Record<symbol, { textureBytes: number; textures: number; created: number; lagMs: number } | undefined>)[Symbol.for('feega.gpu-probe')];
    const peaks = (window as unknown as { __peaks?: { bytes: number; lag: number } }).__peaks;
    const tex = probe ? { count: probe.textures, bytes: Math.max(probe.textureBytes, peaks?.bytes ?? 0), created: probe.created, lag: peaks?.lag ?? probe.lagMs } : w.__gpuCanvas?.textures?.();
    const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
    return { heapMb: heap ? Math.round(heap / mb) : null, textureMb: tex ? Math.round(tex.bytes / mb) : null, textures: tex?.count ?? null, created: (tex as { created?: number } | undefined)?.created ?? null, lagMs: (tex as { lag?: number } | undefined)?.lag ?? null, dom: document.getElementsByTagName('*').length, longTasks: w.__longTasks ?? 0 };
  }, MB);
}

async function run(browser: Browser, name: string, cpu: number, base: string, path: string, gpuPids: () => Set<string>): Promise<Probe> {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: Number(process.env.PROBE_DPR ?? 2), serviceWorkers: 'block' });
  const page = await context.newPage();
  await login(page, base);
  await page.addInitScript(instrument);
  await page.addInitScript(() => {
    const peaks = { bytes: 0, lag: 0 };
    (window as unknown as { __peaks: typeof peaks }).__peaks = peaks;
    setInterval(() => {
      const probe = (window as unknown as Record<symbol, { textureBytes: number; lagMs: number } | undefined>)[Symbol.for('feega.gpu-probe')];
      if (probe) {
        peaks.bytes = Math.max(peaks.bytes, probe.textureBytes);
        peaks.lag = Math.max(peaks.lag, probe.lagMs);
      }
    }, 100);
    const w = window as unknown as { __longTasks: number };
    w.__longTasks = 0;
    try {
      new PerformanceObserver((list) => (w.__longTasks += list.getEntries().length)).observe({ type: 'longtask', buffered: true });
    } catch {
      w.__longTasks = -1;
    }
  });
  if (cpu > 1 && name === 'chromium') {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  }

  let peak = 0;
  const pids = gpuPids();
  const sampler = setInterval(() => (peak = Math.max(peak, rssMb(pids))), SAMPLE_MS);

  const started = Date.now();
  await page.goto(`${base}${path}`, { waitUntil: 'commit' });
  await page.getByRole('button', { name: 'Reject all' }).click({ timeout: 8000 }).catch(() => {});
  await page.locator('[data-canvas-surface]').first().waitFor({ timeout: 60_000 });
  const openMs = Date.now() - started;
  await page.waitForTimeout(SETTLE_MS);
  if (process.env.PROBE_FIT) {
    await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height - 40);
    await page.keyboard.press('Shift+1');
    await page.waitForTimeout(SETTLE_MS);
  }
  const idle = await measure(page, GESTURE_MS, async (until) => {
    while (Date.now() < until) {
      await page.waitForTimeout(100);
    }
  });
  const idleApp = await page.evaluate(() => (window as unknown as { __frames: { appFrames: number } }).__frames.appFrames);
  console.log(`${name} cpu${cpu} idle fps ${idle.fpsAvg} p95 ${idle.p95} work p95 ${idle.workP95} appFrames total ${idleApp}`);

  const pan = await measure(page, GESTURE_MS, (until) => wheelPan(page, until));
  const painted = () => page.locator('[data-testid="core-canvas"]').first().getAttribute('data-painted').then((v) => (v ?? '0,0,0').split(',').map(Number));
  const p0 = await painted();
  const profiler = process.env.PROBE_PROFILE && name === 'chromium' && cpu === 1 ? await context.newCDPSession(page) : null;
  if (profiler) {
    await profiler.send('Profiler.enable');
    await profiler.send('Profiler.setSamplingInterval', { interval: 200 });
    await profiler.send('Profiler.start');
  }
  const zoom = await measure(page, GESTURE_MS, (until) => wheelZoom(page, until));
  if (profiler) {
    const { profile } = await profiler.send('Profiler.stop');
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, 'zoom.cpuprofile'), JSON.stringify(profile));
  }
  const p1 = await painted();
  console.log(`${name} cpu${cpu} zoom outcomes reused/partial/full: ${p1.map((v, i) => v - p0[i]).join('/')}`);
  const after = await snapshot(page);
  clearInterval(sampler);
  await context.close();
  return { browser: name, cpu, openMs, pan, zoom, ...after, gpuProcessPeakMb: pids.size ? peak : null };
}

const row = (p: Probe) =>
  `| ${p.browser} | ${p.cpu === 1 ? 'desktop' : `${p.cpu}x`} | ${p.openMs} | ${p.pan.fpsAvg} | ${p.pan.p95} | ${p.pan.over33} | ${p.zoom.fpsAvg} | ${p.zoom.p95} | ${p.zoom.over33} | ${p.heapMb ?? 'n/a'} | ${p.textures ?? 'n/a'} / ${p.textureMb ?? 'n/a'} | ${p.gpuProcessPeakMb ?? 'n/a'} | ${p.created ?? 'n/a'} | ${p.lagMs == null ? 'n/a' : Math.round(p.lagMs)} | ${p.dom} | ${p.longTasks} |`;

test.describe('heavy canvas copy probe @real', () => {
  test.skip(!FIXTURE || !process.env.E2E_TEST_EMAIL, 'needs HEAVY_FIXTURE and the test account');
  test.setTimeout(600_000);

  test('measures the copied heavy canvas', async ({ baseURL }) => {
    const fixture = JSON.parse(readFileSync(FIXTURE!, 'utf8')) as { projectId: string; canvasId: string };
    const path = `/p/${fixture.projectId}/c/${fixture.canvasId}${process.env.PROBE_QUERY ?? ''}`;
    const rows: Probe[] = [];
    const engines = (process.env.PROBE_ENGINES ?? 'chromium,webkit').split(',');

    if (engines.includes('chromium')) {
      const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu', '--enable-precise-memory-info'] });
      for (const cpu of [1, 4]) {
        rows.push(await run(browser, 'chromium', cpu, baseURL!, path, () => new Set()));
      }
      await browser.close();
    }
    if (engines.includes('webkit')) {
      const before = webkitGpuPids();
      const browser = await webkit.launch({ headless: false });
      const mine = () => new Set([...webkitGpuPids()].filter((p) => !before.has(p)));
      rows.push(await run(browser, 'webkit', 1, baseURL!, path, mine));
      await browser.close();
    }

    const head = '| engine | CPU | open ms | pan fps | pan p95 ms | pan >33 | zoom fps | zoom p95 ms | zoom >33 | JS heap MB | textures n / MB | WebKit GPU proc peak MB | textures created | GPU lag peak ms | DOM nodes | long tasks |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|';
    const text = [head, ...rows.map(row)].join('\n');
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, `${process.env.PROBE_LABEL ?? 'run'}.md`), text);
    writeFileSync(join(OUT, `${process.env.PROBE_LABEL ?? 'run'}.json`), JSON.stringify(rows, null, 2));
    console.log(text);
  });
});
