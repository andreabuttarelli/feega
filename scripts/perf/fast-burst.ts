import { chromium, type Page } from '@playwright/test';

const BASE = process.env.PERF_BASE ?? 'http://localhost:5188';
const PROJECT = process.env.PERF_PROJECT ?? 'f0052fa8-48ff-442f-88d7-1b74c19f0b7b';
const CANVAS = process.env.PERF_CANVAS ?? 'a729ae34-b105-46e6-a974-19f3551bd910';
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const SETTLE_MS = 20_000;
const BURSTS = 12;
const BURST_STEPS = 60;
const PAN_DELTA = 900;
const ZOOM_DELTA = 400;
const MB = 1024 * 1024;

function probe() {
  type Probe = { live: Map<object, number>; liveBytes: number; peakBytes: number; inFlight: number; peakInFlight: number; submits: number; wasm: WebAssembly.Memory[] };
  const p: Probe = { live: new Map(), liveBytes: 0, peakBytes: 0, inFlight: 0, peakInFlight: 0, submits: 0, wasm: [] };
  (window as unknown as { __burst: Probe }).__burst = p;

  const streaming = WebAssembly.instantiateStreaming?.bind(WebAssembly);
  if (streaming) {
    WebAssembly.instantiateStreaming = async (...args) => {
      const made = await streaming(...args);
      Object.values(made.instance.exports).forEach((v) => v instanceof WebAssembly.Memory && p.wasm.push(v));
      return made;
    };
  }

  const g = window as unknown as { GPUDevice?: { prototype: Record<string, (...a: never[]) => unknown> }; GPUTexture?: { prototype: { destroy: () => void } }; GPUQueue?: { prototype: Record<string, (...a: never[]) => unknown> } };
  if (!g.GPUDevice || !g.GPUTexture || !g.GPUQueue) {
    return;
  }
  const create = g.GPUDevice.prototype.createTexture as (d: { size: number[] | { width: number; height?: number }; format: string }) => object;
  g.GPUDevice.prototype.createTexture = function (this: unknown, d: { size: number[] | { width: number; height?: number }; format: string }) {
    const t = create.call(this, d);
    const s = Array.isArray(d.size) ? { width: d.size[0], height: d.size[1] ?? 1 } : { width: d.size.width, height: d.size.height ?? 1 };
    const bytes = s.width * s.height * (/32float/.test(d.format) ? 16 : /16float/.test(d.format) ? 8 : 4);
    p.live.set(t, bytes);
    p.liveBytes += bytes;
    p.peakBytes = Math.max(p.peakBytes, p.liveBytes);
    return t;
  } as never;
  const destroy = g.GPUTexture.prototype.destroy;
  g.GPUTexture.prototype.destroy = function (this: object) {
    const bytes = p.live.get(this) ?? 0;
    const queue = (window as unknown as { __queue?: { onSubmittedWorkDone: () => Promise<void> } }).__queue;
    p.live.delete(this);
    void (queue ? queue.onSubmittedWorkDone() : Promise.resolve()).then(() => (p.liveBytes -= bytes));
    return destroy.call(this);
  };
  const submit = g.GPUQueue.prototype.submit as (b: unknown) => void;
  g.GPUQueue.prototype.submit = function (this: { onSubmittedWorkDone: () => Promise<void> }, b: never) {
    (window as unknown as { __queue: unknown }).__queue = this;
    submit.call(this, b);
    p.submits++;
    p.inFlight++;
    p.peakInFlight = Math.max(p.peakInFlight, p.inFlight);
    void this.onSubmittedWorkDone().then(() => p.inFlight--);
  } as never;
}

async function burst(page: Page, n: number) {
  const { width, height } = PHONE.viewport;
  await page.mouse.move(width / 2, height / 2);
  const zoom = n % 2 === 1;
  if (zoom) {
    await page.keyboard.down('Control');
  }
  for (let i = 0; i < BURST_STEPS; i++) {
    const sign = Math.floor(i / (BURST_STEPS / 2)) ? 1 : -1;
    await page.mouse.wheel(zoom ? 0 : sign * PAN_DELTA, zoom ? sign * ZOOM_DELTA : sign * PAN_DELTA * 0.6);
  }
  if (zoom) {
    await page.keyboard.up('Control');
  }
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu'] });
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
  await page.addInitScript({ content: 'window.__name = (f) => f;' });
  await page.addInitScript(probe);
  let crashed = '';
  page.on('crash', () => (crashed = 'page crashed'));
  page.on('console', (m) => m.text().includes('core off') && (crashed = m.text()));
  await page.goto(`${BASE}/p/${PROJECT}/c/${CANVAS}`);
  await page.waitForSelector('[data-testid=core-canvas]', { state: 'attached', timeout: 60_000 }).catch(async (e) => { console.log(page.url()); await page.screenshot({ path: process.env.PERF_SHOT ?? 'burst-fail.png' }); throw e; });
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(() => {
    const p = (window as unknown as { __burst: { peakBytes: number; liveBytes: number; peakInFlight: number; submits: number } }).__burst;
    p.peakBytes = p.liveBytes;
    p.peakInFlight = 0;
    p.submits = 0;
  });
  const settledAt = Date.now();
  for (let n = 0; n < BURSTS; n++) {
    await burst(page, n);
  }
  const ms = Date.now() - settledAt;
  await page.waitForTimeout(3000);
  const r = await page.evaluate(() => {
    const p = (window as unknown as { __burst: { liveBytes: number; peakBytes: number; peakInFlight: number; submits: number; wasm: WebAssembly.Memory[] } }).__burst;
    return { liveBytes: p.liveBytes, peakBytes: p.peakBytes, peakInFlight: p.peakInFlight, submits: p.submits, wasm: p.wasm.reduce((a, m) => a + m.buffer.byteLength, 0) };
  });
  console.log(JSON.stringify({ base: BASE, crashed, ms, peakTextureMb: +(r.peakBytes / MB).toFixed(1), afterTextureMb: +(r.liveBytes / MB).toFixed(1), peakSubmitsInFlight: r.peakInFlight, submits: r.submits, wasmMb: +(r.wasm / MB).toFixed(1) }));
  await browser.close();
}

void main();
