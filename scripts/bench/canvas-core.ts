import { execSync } from 'node:child_process';
import { chromium, devices, webkit, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';
import heavy from '../../tests/e2e/fixtures/heavy-canvas-landings.json' with { type: 'json' };

const BASE = process.env.BENCH_BASE_URL ?? 'http://localhost:5199';
const SETTLE_MS = Number(process.env.BENCH_SETTLE_MS ?? 12_000);
const PAN_MS = 4000;
const PAN_STEP = 40;
const KB_PER_MB = 1024;
const BYTES_PER_KB = 1024;
const ZOOMS = [4, 0.1];
const ZOOM_SETTLE_MS = 3000;
const ZOOM_STEP = 20;
const ZOOM_PER_DELTA = 0.01;
const ZOOM_AT = { x: Number(process.env.BENCH_ZOOM_X ?? 0.61), y: Number(process.env.BENCH_ZOOM_Y ?? 0.4) };

enum Target {
  Chrome = 'chrome',
  IPhone = 'webkit-iphone'
}

const BROWSER_PROCESSES: Record<Target, RegExp> = {
  [Target.Chrome]: /headless_shell|chrome-headless|Chromium|for Testing/,
  [Target.IPhone]: /WebKit|Playwright|com\.apple\.WebKit/
};

const LAUNCH: Record<Target, () => Promise<Browser>> = {
  [Target.Chrome]: () => chromium.launch({ args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=metal'] }),
  [Target.IPhone]: () => webkit.launch()
};

const CONTEXT: Record<Target, BrowserContextOptions> = {
  [Target.Chrome]: { viewport: { width: 1440, height: 900 } },
  [Target.IPhone]: { ...devices['iPhone 15 Pro'] }
};

const FULL_PAINT_TIMEOUT_MS = 60_000;
const PREVIEW_UPLOAD = /\/card-previews/;

const descendantsOf = (root: string) => {
  const children = new Map<string, string[]>();
  for (const [pid, ppid] of execSync('ps -axo pid=,ppid=').toString().trim().split('\n').map((l) => l.trim().split(/\s+/))) {
    children.set(ppid, [...(children.get(ppid) ?? []), pid]);
  }
  const out = new Set<string>();
  const walk = (pid: string) => (children.get(pid) ?? []).forEach((c) => (out.add(c), walk(c)));
  walk(root);
  return out;
};

const pidsOf = (re: RegExp) =>
  new Set(
    execSync('ps -axo pid=,comm=')
      .toString()
      .split('\n')
      .filter((l) => re.test(l))
      .map((l) => l.trim().split(/\s+/)[0])
  );

function rssMb(pids: Set<string>): number {
  return execSync('ps -axo pid=,rss=')
    .toString()
    .split('\n')
    .map((l) => l.trim().split(/\s+/))
    .filter(([pid]) => pids.has(pid))
    .reduce((sum, [, kb]) => sum + Math.round(Number(kb) / KB_PER_MB), 0);
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
  await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
  await page.press('input[type=password]', 'Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

const COVER_POLL_MS = 100;
const COVER_LIMIT_MS = 30_000;

async function covered(page: Page): Promise<{ placeholdersMs: number | null; coveredMs: number | null }> {
  const start = Date.now();
  let placeholdersMs: number | null = null;
  while (Date.now() - start < COVER_LIMIT_MS) {
    const [held, waiting] = await page.locator('[data-testid=core-canvas]').evaluate((c) => [Number(c.getAttribute('data-held')), Number(c.getAttribute('data-waiting'))]);
    placeholdersMs ??= held > 0 ? Date.now() - start : null;
    if (held > 0 && waiting === 0) {
      return { placeholdersMs, coveredMs: Date.now() - start };
    }
    await page.waitForTimeout(COVER_POLL_MS);
  }
  return { placeholdersMs, coveredMs: null };
}

type Wheel = (dir: number) => string;

const P95 = 0.95;

async function gesture(page: Page, ms: number, wheel: Wheel): Promise<{ fps: number; worstMs: number; p95Ms: number }> {
  await page.evaluate('window.__bench = []; window.__benchOn = true; (function tick(t) { if (t) window.__bench.push(t); if (window.__benchOn) requestAnimationFrame(tick); })()');
  const start = Date.now();
  while (Date.now() - start < ms) {
    await page.evaluate(wheel(Date.now() - start > ms / 2 ? -1 : 1));
    await page.waitForTimeout(16);
  }
  const stamps = (await page.evaluate('window.__benchOn = false, window.__bench')) as number[];
  const gaps = stamps
    .slice(1)
    .map((t, i) => t - stamps[i])
    .sort((a, b) => a - b);
  return { fps: Math.round((stamps.length / ms) * 1000), worstMs: Math.round(gaps.at(-1) ?? 0), p95Ms: Math.round(gaps[Math.floor(gaps.length * P95)] ?? 0) };
}

function pan(page: Page) {
  const box = page.viewportSize()!;
  return gesture(page, PAN_MS, (dir) => `document.elementFromPoint(${box.width / 2}, ${box.height / 2})?.dispatchEvent(new WheelEvent('wheel', { clientX: ${box.width / 2}, clientY: ${box.height / 2}, deltaX: ${PAN_STEP * dir}, deltaY: ${(PAN_STEP / 2) * dir}, bubbles: true, cancelable: true }))`);
}

const ZOOM_GESTURE_MS = 3000;
const ZOOM_GESTURE_STEP = 8;

function zoomMotion(page: Page) {
  const box = page.viewportSize()!;
  return gesture(page, ZOOM_GESTURE_MS, (dir) => `document.elementFromPoint(${box.width / 2}, ${box.height / 2})?.dispatchEvent(new WheelEvent('wheel', { clientX: ${box.width / 2}, clientY: ${box.height / 2}, deltaY: ${ZOOM_GESTURE_STEP * dir}, ctrlKey: true, bubbles: true, cancelable: true }))`);
}

async function zoomMotion(page: Page): Promise<{ zoomFps: number; zoomWorstMs: number }> {
  await page.evaluate('window.__bench = []');
  const size = page.viewportSize()!;
  const start = Date.now();
  while (Date.now() - start < PAN_MS) {
    const dir = Date.now() - start > PAN_MS / 2 ? 1 : -1;
    await page.evaluate(`document.elementFromPoint(${size.width / 2}, ${size.height / 2})?.dispatchEvent(new WheelEvent('wheel', { clientX: ${size.width / 2}, clientY: ${size.height / 2}, deltaY: ${ZOOM_STEP * dir}, ctrlKey: true, bubbles: true, cancelable: true }))`);
    await page.waitForTimeout(16);
  }
  const stamps = (await page.evaluate('window.__bench')) as number[];
  const gaps = stamps.slice(1).map((t, i) => t - stamps[i]);
  return { zoomFps: Math.round((stamps.length / PAN_MS) * 1000), zoomWorstMs: Math.round(Math.max(...gaps)) };
}

const zoomOf = async (page: Page) => Number(((await page.locator('[data-view]').first().getAttribute('data-view')) ?? '0,0,1').split(',')[2]);

async function zoomTo(page: Page, zoom: number) {
  const size = page.viewportSize()!;
  const box = { width: size.width * ZOOM_AT.x * 2, height: size.height * ZOOM_AT.y * 2 };
  for (let i = 0; i < 400; i++) {
    const now = await zoomOf(page);
    if (Math.abs(Math.log(now / zoom)) < ZOOM_PER_DELTA * ZOOM_STEP) {
      return;
    }
    const delta = Math.sign(Math.log(now / zoom)) * Math.min(ZOOM_STEP, Math.abs(Math.log(now / zoom)) / ZOOM_PER_DELTA);
    await page.evaluate(`document.elementFromPoint(${box.width / 2}, ${box.height / 2})?.dispatchEvent(new WheelEvent('wheel', { clientX: ${box.width / 2}, clientY: ${box.height / 2}, deltaY: ${delta}, ctrlKey: true, bubbles: true, cancelable: true }))`);
    await page.waitForTimeout(16);
  }
}

async function zoomShots(page: Page, target: Target, renderer: string) {
  const shots: Record<string, number> = {};
  for (const zoom of ZOOMS) {
    await zoomTo(page, zoom);
    await page.waitForTimeout(ZOOM_SETTLE_MS);
    shots[`z${zoom}`] = await zoomOf(page);
    await page.screenshot({ path: `${process.env.BENCH_OUT ?? '.'}/${target}-${renderer}-z${zoom}.png` });
  }
  return shots;
}

async function run(target: Target, renderer: string) {
  const before = pidsOf(BROWSER_PROCESSES[target]);
  const browser = await LAUNCH[target]();
  const page = await (await browser.newContext({ ...CONTEXT[target], serviceWorkers: 'block' })).newPage();
  await login(page);
  const mine = () => new Set([...descendantsOf(String(process.pid)), ...[...pidsOf(BROWSER_PROCESSES[target])].filter((p) => !before.has(p))]);
  let images = 0;
  let uploads = 0;
  page.on('request', (r) => {
    images += r.resourceType() === 'image' || r.resourceType() === 'media' ? 1 : 0;
    uploads += r.method() !== 'GET' && PREVIEW_UPLOAD.test(r.url()) ? 1 : 0;
  });
  const t0 = Date.now();
  await page.goto(`${BASE}/p/${heavy.projectId}/c/${heavy.canvasId}?renderer=${renderer}`);
  await page.getByRole('button', { name: 'Reject all' }).click({ timeout: 8000 }).catch(() => undefined);
  await page.locator('[data-renderer]:not([data-renderer="pending"])').first().waitFor({ timeout: 30_000 });
  const firstMs = Date.now() - t0;
  const core = page.locator('[data-testid=core-canvas]');
  const coverage = renderer === 'core' ? await core.waitFor({ state: 'attached', timeout: 10_000 }).then(() => covered(page), () => null) : null;
  const fullPaintMs = (await page.waitForFunction('window.__gpuCanvas?.settled', null, { timeout: FULL_PAINT_TIMEOUT_MS }).then((h) => h.jsonValue(), () => null)) as number | null;
  await page.waitForTimeout(SETTLE_MS);
  const idleMb = rssMb(mine());
  const pixiTextureMb = Math.round(((await page.evaluate('window.__gpuCanvas?.textures?.().bytes ?? 0')) as number) / 1024 / 1024);
  await page.screenshot({ path: `${process.env.BENCH_OUT ?? '.'}/${target}-${renderer}-settled.png` });
  const motion = { ...(await pan(page)), ...(await zoomMotion(page)) };
  const panMb = rssMb(mine());
  const zooming = await zoomMotion(page);
  const painted = (await core.count()) ? await core.getAttribute('data-painted') : null;
  const coreFrames = (await core.count()) ? `${await core.getAttribute('data-frames')} whole, ${await core.getAttribute('data-partial')} partial` : null;
  const cacheKb = (await core.count()) ? Math.round(Number(await core.getAttribute('data-cache-bytes')) / BYTES_PER_KB) : null;
  const backend = await page.locator('[data-renderer]').first().getAttribute('data-renderer');
  await page.screenshot({ path: `${process.env.BENCH_OUT ?? '.'}/${target}-${renderer}.png` });
  const zooms = await zoomShots(page, target, renderer);
  await browser.close();
  return { target, renderer, backend, coreFrames, firstMs, fullPaintMs, imageRequests: images, previewUploads: uploads, ...coverage, pixiTextureMb, cacheKb, idleBrowserMb: idleMb, panBrowserMb: panMb, ...motion, zoomFps: zooming.fps, zoomWorstMs: zooming.worstMs, zoomP95Ms: zooming.p95Ms, painted, zooms };
}

const targets = (process.env.BENCH_TARGETS ?? `${Target.Chrome},${Target.IPhone}`).split(',') as Target[];
for (const target of targets) {
  for (const renderer of (process.env.BENCH_RENDERERS ?? 'gpu,core').split(',')) {
    console.log(JSON.stringify(await run(target, renderer)));
  }
}
