import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium, type Page } from '@playwright/test';
import { instrument, measure } from '../../tests/e2e/fixtures/frame-sweeps';

const BASE = process.env.PERF_BASE ?? 'http://localhost:5188';
const OUT = process.env.PERF_OUT ?? new URL('./out/', import.meta.url).pathname;
const TAG = process.env.PERF_TAG ?? 'run';
const FIXTURE = JSON.parse(readFileSync(new URL('./fixture.json', import.meta.url), 'utf8')) as { projectId: string; canvasId: string };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const SESSION_MS = Number(process.env.PERF_SESSION_MS ?? 5 * 60_000);
const LEG_MS = 20_000;
const SAMPLE_MS = 2000;
const SETTLE_MS = 20_000;
const FPS_MS = 6000;
const TSX_NAME_SHIM = 'window.__name = (f) => f;';
const MB = 1024 * 1024;

type Sample = { t: number; wasm: number; textures: number; textureBytes: number; bitmaps: number; bitmapBytes: number; videos: number; heap: number };

function probeMemory() {
  type Mem = { wasm: WebAssembly.Memory[]; textures: Map<object, number>; bitmaps: Map<object, number>; videos: Set<object> };
  const mem: Mem = { wasm: [], textures: new Map(), bitmaps: new Map(), videos: new Set() };
  (window as unknown as { __mem: Mem }).__mem = mem;

  const keep = (exports: WebAssembly.Exports) => Object.values(exports).forEach((v) => v instanceof WebAssembly.Memory && mem.wasm.push(v));
  const instantiate = WebAssembly.instantiate.bind(WebAssembly);
  WebAssembly.instantiate = (async (...args: Parameters<typeof WebAssembly.instantiate>) => {
    const made = (await instantiate(...args)) as WebAssembly.Instance | WebAssembly.WebAssemblyInstantiatedSource;
    keep('instance' in made ? made.instance.exports : made.exports);
    return made;
  }) as typeof WebAssembly.instantiate;
  const streaming = WebAssembly.instantiateStreaming?.bind(WebAssembly);
  if (streaming) {
    WebAssembly.instantiateStreaming = async (...args) => {
      const made = await streaming(...args);
      keep(made.instance.exports);
      return made;
    };
  }

  const gpu = (window as unknown as { GPUDevice?: { prototype: { createTexture: (d: { size: number[] | { width: number; height?: number }; format: string }) => object } }; GPUTexture?: { prototype: { destroy: () => void } } });
  if (gpu.GPUDevice && gpu.GPUTexture) {
    const create = gpu.GPUDevice.prototype.createTexture;
    gpu.GPUDevice.prototype.createTexture = function (d) {
      const t = create.call(this, d);
      const s = Array.isArray(d.size) ? { width: d.size[0], height: d.size[1] ?? 1 } : { width: d.size.width, height: d.size.height ?? 1 };
      const texel = /32float/.test(d.format) ? 16 : /16float/.test(d.format) ? 8 : 4;
      mem.textures.set(t, s.width * s.height * texel);
      return t;
    };
    const destroy = gpu.GPUTexture.prototype.destroy;
    gpu.GPUTexture.prototype.destroy = function () {
      mem.textures.delete(this);
      return destroy.call(this);
    };
  }

  const bitmap = window.createImageBitmap.bind(window);
  window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
    const b = await bitmap(...args);
    mem.bitmaps.set(b, b.width * b.height * 4);
    const close = b.close.bind(b);
    b.close = () => (mem.bitmaps.delete(b), close());
    return b;
  }) as typeof createImageBitmap;

  const make = document.createElement.bind(document);
  document.createElement = ((tag: string, o?: ElementCreationOptions) => {
    const el = make(tag, o);
    if (tag.toLowerCase() === 'video') {
      mem.videos.add(el);
    }
    return el;
  }) as typeof document.createElement;
}

const sample = (page: Page, t: number): Promise<Sample> =>
  page.evaluate((t) => {
    const mem = (window as unknown as { __mem: { wasm: WebAssembly.Memory[]; textures: Map<object, number>; bitmaps: Map<object, number>; videos: Set<HTMLVideoElement> } }).__mem;
    const sum = (m: Map<object, number>) => [...m.values()].reduce((a, b) => a + b, 0);
    const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0;
    const live = [...mem.videos].filter((v) => v.src || v.currentSrc).length;
    return { t, wasm: mem.wasm.reduce((a, m) => a + m.buffer.byteLength, 0), textures: mem.textures.size, textureBytes: sum(mem.textures), bitmaps: mem.bitmaps.size, bitmapBytes: sum(mem.bitmaps), videos: live, heap };
  }, t);

async function leg(page: Page, until: number, dir: number) {
  const { width, height } = PHONE.viewport;
  await page.mouse.move(width / 2, height / 2);
  for (let i = 0; Date.now() < until; i++) {
    if (Math.floor(i / 40) % 3 === 2) {
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, Math.floor(i / 10) % 2 ? 40 : -40);
      await page.keyboard.up('Control');
      continue;
    }
    await page.mouse.wheel(dir * 90, Math.sin(i / 15) * 60);
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-precise-memory-info', '--enable-unsafe-webgpu'] });
  const login = await browser.newContext(PHONE);
  const lp = await login.newPage();
  await lp.goto(`${BASE}/login`);
  await lp.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
  await lp.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
  await lp.press('input[type=password]', 'Enter');
  await lp.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'commit' });
  await lp.waitForTimeout(2000);
  const state = await login.storageState();
  await login.close();

  const context = await browser.newContext({ ...PHONE, storageState: state });
  const page = await context.newPage();
  await page.addInitScript({ content: TSX_NAME_SHIM });
  await page.addInitScript(instrument);
  await page.addInitScript(probeMemory);
  let fellBack = '';
  page.on('console', (m) => m.text().includes('core off') && (fellBack = m.text()));
  page.on('crash', () => (fellBack = 'page crashed'));
  await page.goto(`${BASE}/p/${process.env.PERF_PROJECT ?? FIXTURE.projectId}/c/${process.env.PERF_CANVAS ?? FIXTURE.canvasId}`);
  await page.waitForSelector('[data-testid=core-canvas]', { timeout: 60_000 });
  await page.waitForTimeout(SETTLE_MS);

  const start = Date.now();
  const samples: Sample[] = [await sample(page, 0)];
  const fps = [await measure(page, FPS_MS, (until) => leg(page, until, 1))];
  for (let n = 0; Date.now() - start < SESSION_MS; n++) {
    const until = Math.min(Date.now() + LEG_MS, start + SESSION_MS);
    const legging = leg(page, until, n % 4 < 2 ? 1 : -1);
    while (Date.now() < until) {
      await page.waitForTimeout(SAMPLE_MS);
      samples.push(await sample(page, Date.now() - start));
    }
    await legging;
  }
  fps.push(await measure(page, FPS_MS, (until) => leg(page, until, -1)));
  await page.waitForTimeout(5000);
  samples.push(await sample(page, Date.now() - start));

  const peak = (k: keyof Sample) => Math.max(...samples.map((s) => s[k]));
  const tail = samples.slice(-5);
  const steady = (k: keyof Sample) => tail.reduce((a, s) => a + s[k], 0) / tail.length;
  const row = (k: keyof Sample, bytes: boolean) => ({ peak: bytes ? +(peak(k) / MB).toFixed(1) : peak(k), steady: bytes ? +(steady(k) / MB).toFixed(1) : Math.round(steady(k)) });
  const result = {
    tag: TAG,
    fellBack,
    wasmMb: row('wasm', true),
    textures: row('textures', false),
    textureMb: row('textureBytes', true),
    bitmaps: row('bitmaps', false),
    bitmapMb: row('bitmapBytes', true),
    videos: row('videos', false),
    heapMb: row('heap', true),
    fps
  };
  writeFileSync(`${OUT}/${TAG}.json`, JSON.stringify({ result, samples }, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}

void main();
