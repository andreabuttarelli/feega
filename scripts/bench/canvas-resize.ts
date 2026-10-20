import { chromium, devices, webkit, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';
import heavy from '../../tests/e2e/fixtures/heavy-canvas-landings.json' with { type: 'json' };

const BASE = process.env.BENCH_BASE_URL ?? 'http://localhost:5199';
const SETTLE_MS = Number(process.env.BENCH_SETTLE_MS ?? 12_000);
const PAN_STEP = 40;
const DRAG_PX = 120;
const DRAG_STEPS = 60;
const SELECT_MS = 1500;
const CENTRE_TRIES = 200;
const MIN_SHAPE_PX = 200;
const FIT = 0.8;

enum Target {
  Chrome = 'chrome',
  IPhone = 'webkit-iphone'
}

const LAUNCH: Record<Target, () => Promise<Browser>> = {
  [Target.Chrome]: () => chromium.launch({ args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=metal'] }),
  [Target.IPhone]: () => webkit.launch()
};

const CONTEXT: Record<Target, BrowserContextOptions> = {
  [Target.Chrome]: { viewport: { width: 1440, height: 900 } },
  [Target.IPhone]: { ...devices['iPhone 15 Pro'], hasTouch: false, isMobile: false }
};

const NODES = { landing: heavy.landings[0].desktop.nodeId, shape: heavy.free.loose[0] };

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
  await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
  await page.press('input[type=password]', 'Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

async function centre(page: Page, id: string) {
  const size = page.viewportSize()!;
  const tile = page.locator(`[data-testid=gpu-node][data-id="${id}"]`);
  for (let i = 0; i < CENTRE_TRIES; i++) {
    const b = await tile.boundingBox();
    if (!b) {
      return;
    }
    const [dx, dy] = [b.x + Math.min(b.width, size.width) / 2 - size.width / 2, b.y + Math.min(b.height, size.height) / 2 - size.height / 2];
    if (Math.abs(dx) < PAN_STEP && Math.abs(dy) < PAN_STEP) {
      return;
    }
    const step = (d: number) => Math.sign(d) * Math.min(Math.abs(d), PAN_STEP * 10);
    await page.evaluate(`document.elementFromPoint(${size.width / 2}, ${size.height / 2})?.dispatchEvent(new WheelEvent('wheel', { clientX: ${size.width / 2}, clientY: ${size.height / 2}, deltaX: ${step(dx)}, deltaY: ${step(dy)}, bubbles: true, cancelable: true }))`);
    await page.waitForTimeout(16);
  }
}

async function resize(page: Page, id: string): Promise<{ fps: number; worstMs: number; resized: boolean; players: number } | { handles: number; box: unknown }> {
  await centre(page, id);
  const tile = page.locator(`[data-testid=gpu-node][data-id="${id}"]`);
  const size = page.viewportSize()!;
  for (let i = 0; i < CENTRE_TRIES; i++) {
    const t = (await tile.boundingBox())!;
    const big = t.height > size.height * FIT || t.width > size.width * FIT;
    const small = t.width < Math.min(MIN_SHAPE_PX, size.width * FIT / 2);
    if (!big && !small) {
      break;
    }
    const [cx, cy] = [Math.min(Math.max(t.x + t.width / 2, 1), size.width - 1), Math.min(Math.max(t.y + t.height / 2, 1), size.height - 1)];
    await page.evaluate(`document.elementFromPoint(${cx}, ${cy})?.dispatchEvent(new WheelEvent('wheel', { clientX: ${cx}, clientY: ${cy}, deltaY: ${big ? PAN_STEP : -PAN_STEP}, ctrlKey: true, bubbles: true, cancelable: true }))`);
    await centre(page, id);
    await page.waitForTimeout(16);
  }
  await centre(page, id);
  await page.waitForTimeout(SELECT_MS);
  const b = (await tile.boundingBox())!;
  await page.keyboard.press('Escape');
  await tile.click({ position: { x: 4, y: Math.max(4, 4 - b.y) }, force: true });
  await page.waitForTimeout(SELECT_MS);
  const t = (await tile.boundingBox())!;
  const corner = { x: t.x + t.width - 1, y: t.y + t.height - 1 };
  if (corner.x > size.width || corner.y > size.height) {
    return { handles: 0, box: t };
  }
  const h = { ...corner, width: 0, height: 0 };
  const before = await tile.getAttribute('data-box');
  let resized = false;
  await page.evaluate(`window.__loaf = []; try { new PerformanceObserver((l) => window.__loaf.push(...l.getEntries().map((e) => ({ d: Math.round(e.duration), scripts: e.scripts.map((s) => [Math.round(s.duration), s.invoker, s.sourceFunctionName, (s.sourceURL || '').split('/').slice(-1)[0]]) })))).observe({ type: 'long-animation-frame' }); } catch {}`);
  const playersBefore = (await page.evaluate('window.__players')) as number;
  await page.evaluate('window.__bench = []; (function tick(t) { if (t) window.__bench.push(t); requestAnimationFrame(tick); })()');
  const cdp = process.env.PROBE ? await page.context().newCDPSession(page).catch(() => null) : null;
  await cdp?.send('Profiler.enable');
  await cdp?.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp?.send('Profiler.start');
  const start = performance.now();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= DRAG_STEPS; i++) {
    const out = -DRAG_PX * Math.sin((Math.PI * i) / DRAG_STEPS);
    await page.mouse.move(h.x + h.width / 2 + out, h.y + h.height / 2 + out / 2);
    await page.waitForTimeout(16);
    resized ||= i === DRAG_STEPS / 2 && (await tile.getAttribute('data-box')) !== before;
  }
  await page.mouse.up();
  const ms = performance.now() - start;
  const stamps = (await page.evaluate('window.__bench')) as number[];
  const gaps = stamps.slice(1).map((t, i) => t - stamps[i]);
  if (cdp) {
    const { profile } = (await cdp.send('Profiler.stop')) as { profile: { nodes: { id: number; callFrame: { functionName: string; url: string; lineNumber: number }; children?: number[] }[]; samples: number[]; timeDeltas: number[] } };
    const self = new Map<number, number>();
    profile.samples.forEach((n, i) => self.set(n, (self.get(n) ?? 0) + (profile.timeDeltas[i] ?? 0)));
    const parent = new Map<number, number>();
    profile.nodes.forEach((n) => n.children?.forEach((c) => parent.set(c, n.id)));
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const total = new Map<string, number>();
    const selfBy = new Map<string, number>();
    const name = (id: number) => { const f = byId.get(id)!.callFrame; return `${f.functionName || '(anon)'}@${f.url.split('/').slice(-1)[0].split('?')[0]}:${f.lineNumber}`; };
    for (const [id, us] of self) {
      selfBy.set(name(id), (selfBy.get(name(id)) ?? 0) + us);
      const seen = new Set<string>();
      for (let n: number | undefined = id; n !== undefined; n = parent.get(n)) {
        const k = name(n);
        if (!seen.has(k)) { seen.add(k); total.set(k, (total.get(k) ?? 0) + us); }
      }
    }
    const top = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${Math.round(v / 1000)}ms ${k}`).join('\n');
    console.log('SELF\n' + top(selfBy) + '\nTOTAL\n' + top(total));
  }
  console.log('loaf', JSON.stringify(((await page.evaluate('window.__loaf')) as { d: number }[]).sort((a, b) => b.d - a.d).slice(0, 4)));
  await page.keyboard.press('Escape');
  return { fps: Math.round((stamps.length / ms) * 1000), worstMs: Math.round(Math.max(...gaps)), resized, players: ((await page.evaluate('window.__players')) as number) - playersBefore };
}

async function run(target: Target, renderer: string) {
  const browser = await LAUNCH[target]();
  const page = await (await browser.newContext({ ...CONTEXT[target], serviceWorkers: 'block' })).newPage();
  await page.addInitScript(() => {
    const w = window as unknown as { __players: number; AudioContext: typeof AudioContext };
    w.__players = 0;
    const Real = w.AudioContext;
    if (Real) {
      w.AudioContext = class extends Real {
        constructor(...a: ConstructorParameters<typeof AudioContext>) {
          super(...a);
          w.__players++;
        }
      };
    }
  });
  await login(page);
  await page.goto(`${BASE}/p/${heavy.projectId}/c/${heavy.canvasId}?renderer=${renderer}`);
  await page.getByRole('button', { name: 'Reject all' }).click({ timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(SETTLE_MS);
  const out: Record<string, unknown> = { target, renderer };
  for (const [name, id] of Object.entries(NODES)) {
    out[name] = await resize(page, id);
  }
  await browser.close();
  return out;
}

const targets = (process.env.BENCH_TARGETS ?? `${Target.Chrome},${Target.IPhone}`).split(',') as Target[];
for (const target of targets) {
  for (const renderer of (process.env.BENCH_RENDERERS ?? 'gpu,core').split(',')) {
    console.log(JSON.stringify(await run(target, renderer)));
  }
}
