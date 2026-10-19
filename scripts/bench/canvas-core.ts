import { execSync } from 'node:child_process';
import { chromium, devices, webkit, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';
import heavy from '../../tests/e2e/fixtures/heavy-canvas-landings.json' with { type: 'json' };

const BASE = process.env.BENCH_BASE_URL ?? 'http://localhost:5199';
const SETTLE_MS = Number(process.env.BENCH_SETTLE_MS ?? 12_000);
const PAN_MS = 4000;
const PAN_STEP = 40;
const KB_PER_MB = 1024;

enum Target {
  Chrome = 'chrome',
  IPhone = 'webkit-iphone'
}

const BROWSER_PROCESSES: Record<Target, RegExp> = {
  [Target.Chrome]: /headless_shell|chrome-headless|Chromium|for Testing/,
  [Target.IPhone]: /WebKit|Playwright/
};

const LAUNCH: Record<Target, () => Promise<Browser>> = {
  [Target.Chrome]: () => chromium.launch({ args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=metal'] }),
  [Target.IPhone]: () => webkit.launch()
};

const CONTEXT: Record<Target, BrowserContextOptions> = {
  [Target.Chrome]: { viewport: { width: 1440, height: 900 } },
  [Target.IPhone]: { ...devices['iPhone 15 Pro'] }
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

async function pan(page: Page): Promise<{ fps: number; worstMs: number }> {
  await page.evaluate('window.__bench = []; (function tick(t) { if (t) window.__bench.push(t); requestAnimationFrame(tick); })()');
  const box = page.viewportSize()!;
  const start = Date.now();
  let dir = 1;
  while (Date.now() - start < PAN_MS) {
    await page.evaluate(`document.elementFromPoint(${box.width / 2}, ${box.height / 2})?.dispatchEvent(new WheelEvent('wheel', { clientX: ${box.width / 2}, clientY: ${box.height / 2}, deltaX: ${PAN_STEP * dir}, deltaY: ${PAN_STEP / 2}, bubbles: true, cancelable: true }))`);
    dir = Date.now() - start > PAN_MS / 2 ? -1 : 1;
    await page.waitForTimeout(16);
  }
  const stamps = (await page.evaluate("window.__bench")) as number[];
  const gaps = stamps.slice(1).map((t, i) => t - stamps[i]);
  return { fps: Math.round((stamps.length / PAN_MS) * 1000), worstMs: Math.round(Math.max(...gaps)) };
}

const COVER_POLL_MS = 50;
const COVER_LIMIT_MS = 30_000;

async function covered(page: Page, t0: number, drawnMs: number): Promise<{ coveredMs: number | null; wholeMs: number | null; holesAt1s: string | null }> {
  const core = page.locator('[data-testid=core-canvas]');
  let coveredMs: number | null = null;
  let holesAt1s: string | null = null;
  while (Date.now() - t0 < COVER_LIMIT_MS) {
    const [holes, standing] = (await core.count()) ? [await core.getAttribute('data-holes'), await core.getAttribute('data-standing-in')] : [null, null];
    const at = Date.now() - t0;
    if (holesAt1s === null && at - drawnMs >= 1000) {
      holesAt1s = holes;
      await page.screenshot({ path: `${process.env.BENCH_OUT ?? '.'}/${page.context().browser()?.browserType().name()}-1s.png` });
    }
    coveredMs ??= holes === '0' ? at - drawnMs : null;
    if (standing === '0' && holes === '0') {
      return { coveredMs, wholeMs: at - drawnMs, holesAt1s: holesAt1s ?? holes };
    }
    await page.waitForTimeout(COVER_POLL_MS);
  }
  return { coveredMs, wholeMs: null, holesAt1s, standingIn: await core.getAttribute('data-standing-in') };
}

async function run(target: Target, renderer: string) {
  const before = pidsOf(BROWSER_PROCESSES[target]);
  const browser = await LAUNCH[target]();
  const page = await (await browser.newContext({ ...CONTEXT[target], serviceWorkers: 'block' })).newPage();
  await login(page);
  const mine = () => new Set([...pidsOf(BROWSER_PROCESSES[target])].filter((p) => !before.has(p)));
  const t0 = Date.now();
  await page.goto(`${BASE}/p/${heavy.projectId}/c/${heavy.canvasId}${renderer ? `?renderer=${renderer}` : ''}`);
  await page.getByRole('button', { name: 'Reject all' }).click({ timeout: 8000 }).catch(() => undefined);
  await page.locator('[data-renderer]:not([data-renderer="pending"])').first().waitFor({ timeout: 30_000 });
  const firstMs = Date.now() - t0;
  const cover = renderer === 'core' ? await covered(page, t0, firstMs) : null;
  await page.waitForTimeout(SETTLE_MS);
  const idleMb = rssMb(mine());
  const pixiTextureMb = Math.round(((await page.evaluate('window.__gpuCanvas?.textures?.().bytes ?? 0')) as number) / 1024 / 1024);
  await page.screenshot({ path: `${process.env.BENCH_OUT ?? '.'}/${target}-${renderer || 'gpu'}-settled.png` });
  const motion = await pan(page);
  const panMb = rssMb(mine());
  const core = page.locator('[data-testid=core-canvas]');
  const coreFrames = (await core.count()) ? `${await core.getAttribute('data-frames')} whole, ${await core.getAttribute('data-partial')} partial` : null;
  const backend = await page.locator('[data-renderer]').first().getAttribute('data-renderer');
  await page.screenshot({ path: `${process.env.BENCH_OUT ?? '.'}/${target}-${renderer || 'gpu'}.png` });
  await browser.close();
  return { target, renderer: renderer || 'gpu', backend, coreFrames, firstMs, ...cover, pixiTextureMb, idleBrowserMb: idleMb, panBrowserMb: panMb, ...motion };
}

const targets = (process.env.BENCH_TARGETS ?? `${Target.Chrome},${Target.IPhone}`).split(',') as Target[];
for (const target of targets) {
  for (const renderer of (process.env.BENCH_RENDERERS ?? ',core').split(',')) {
    console.log(JSON.stringify(await run(target, renderer)));
  }
}
