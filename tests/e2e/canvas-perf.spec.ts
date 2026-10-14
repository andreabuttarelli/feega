import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import type { CDPSession, Page } from '@playwright/test';
import { test, expect, REAL_STACK } from './fixtures/session';
import plainDoc from './fixtures/motion-doc.json' with { type: 'json' };
import webglDoc from './fixtures/motion-webgl-doc.json' with { type: 'json' };
import { CONSENT_COOKIE, CONSENT_VERSION, encodeConsent } from '../../src/lib/consent-model';

type Seed = { x: number; y: number; format: string; doc: unknown; poster: Buffer };
type Live = { players: number; offscreen: number; iframes: number; webgl: number };
type Motion = { fpsAvg: number; fpsP5: number; longTasks: number; longTaskMs: number; peakPlayers: number; peakOffscreen: number };
type Report = { loadMs: number; afterLoad: Live; pan: Motion; zoom: Motion; heapMb: number; dom: number };

const COLUMNS = 4;
const STEP = { x: 520, y: 640 };
const NODES = 21;
const FORMATS = ['16:9', '9:16', '1:1', '4:5'];
const SETTLE_MS = 3000;
const PAN_MS = 10_000;
const ZOOM_MS = 4000;
const SAMPLE_MS = 250;
const PHONE_CPU_SLOWDOWN = 4;
const DESKTOP_MIN_FPS = 40;
const PHONE_MIN_FPS = 20;
const SOURCE = process.env.CANVAS_PERF_SOURCE;
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

async function syntheticSeeds(): Promise<Seed[]> {
  const poster = await sharp({ create: { width: 480, height: 270, channels: 3, background: '#335' } }).jpeg().toBuffer();
  return Array.from({ length: NODES }, (_, i) => ({
    x: (i % COLUMNS) * STEP.x,
    y: Math.floor(i / COLUMNS) * STEP.y,
    format: FORMATS[i % FORMATS.length],
    doc: i % 2 ? webglDoc : plainDoc,
    poster
  }));
}

function recordedSeeds(path: string): Seed[] {
  const rows = JSON.parse(readFileSync(path, 'utf8')) as { x: number; y: number; data: { format: string }; doc: unknown; poster: string }[];
  return rows.map((r) => ({ x: Number(r.x), y: Number(r.y), format: r.data.format, doc: r.doc, poster: Buffer.from(r.poster, 'base64') }));
}

const instrument = () => {
  const own = window as unknown as { __webgl: number; __perf: { gaps: number[]; longTasks: number; longTaskMs: number; counting: boolean } };
  own.__webgl = 0;
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
    const context = (original as (...a: unknown[]) => unknown).call(this, kind, ...rest);
    if (context && kind.startsWith('webgl')) {
      own.__webgl += 1;
    }
    return context;
  } as typeof original;

  if (window !== window.top) {
    return;
  }
  own.__perf = { gaps: [], longTasks: 0, longTaskMs: 0, counting: false };
  let last = 0;
  const tick = (now: number) => {
    if (own.__perf.counting && last) {
      own.__perf.gaps.push(now - last);
    }
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  new PerformanceObserver((list) => {
    if (!own.__perf.counting) {
      return;
    }
    for (const entry of list.getEntries()) {
      own.__perf.longTasks += 1;
      own.__perf.longTaskMs += entry.duration;
    }
  }).observe({ type: 'longtask', buffered: false });
};

async function live(page: Page): Promise<Live> {
  const top = await page.evaluate(() => {
    const players = [...document.querySelectorAll('[data-testid="motion-node"] hyperframes-player')];
    const offscreen = players.filter((p) => {
      const box = p.getBoundingClientRect();
      return box.right < 0 || box.bottom < 0 || box.left > innerWidth || box.top > innerHeight;
    });
    return { players: players.length, offscreen: offscreen.length, iframes: document.querySelectorAll('iframe').length };
  });
  let webgl = 0;
  for (const frame of page.frames()) {
    webgl += await frame.evaluate(() => (window as unknown as { __webgl?: number }).__webgl ?? 0).catch(() => 0);
  }
  return { ...top, webgl };
}

async function heapAndDom(cdp: CDPSession) {
  const { metrics } = (await cdp.send('Performance.getMetrics')) as { metrics: { name: string; value: number }[] };
  const value = (name: string) => metrics.find((m) => m.name === name)?.value ?? 0;
  return { heapMb: Math.round(value('JSHeapUsedSize') / 1e6), dom: Math.round(value('Nodes')) };
}

async function during(page: Page, ms: number, gesture: (until: number) => Promise<void>): Promise<Motion> {
  await page.evaluate(() => {
    const perf = (window as unknown as { __perf: { gaps: number[]; longTasks: number; longTaskMs: number; counting: boolean } }).__perf;
    Object.assign(perf, { gaps: [], longTasks: 0, longTaskMs: 0, counting: true });
  });
  const until = Date.now() + ms;
  let peakPlayers = 0;
  let peakOffscreen = 0;
  const watching = (async () => {
    while (Date.now() < until) {
      const now = await live(page);
      peakPlayers = Math.max(peakPlayers, now.players);
      peakOffscreen = Math.max(peakOffscreen, now.offscreen);
      await page.waitForTimeout(SAMPLE_MS);
    }
  })();
  await gesture(until);
  await watching;
  const perf = await page.evaluate(() => {
    const own = (window as unknown as { __perf: { gaps: number[]; longTasks: number; longTaskMs: number; counting: boolean } }).__perf;
    own.counting = false;
    return { gaps: [...own.gaps], longTasks: own.longTasks, longTaskMs: own.longTaskMs };
  });
  const gaps = perf.gaps.sort((a, b) => a - b);
  const mean = gaps.reduce((sum, g) => sum + g, 0) / Math.max(1, gaps.length);
  const p95 = gaps[Math.floor(gaps.length * 0.95)] ?? mean;
  return { fpsAvg: Math.round(1000 / mean), fpsP5: Math.round(1000 / p95), longTasks: perf.longTasks, longTaskMs: Math.round(perf.longTaskMs), peakPlayers, peakOffscreen };
}

async function sweep(page: Page, until: number) {
  const size = page.viewportSize()!;
  for (let i = 0; Date.now() < until - SAMPLE_MS; i++) {
    const t = i / 12;
    await page.mouse.move(((Math.sin(t) + 1) / 2) * size.width, ((Math.cos(t * 0.7) + 1) / 2) * size.height);
    await page.mouse.wheel(Math.sin(t) * 40, Math.cos(t) * 40);
  }
}

async function zoom(page: Page, until: number) {
  const size = page.viewportSize()!;
  await page.mouse.move(size.width / 2, size.height / 2);
  await page.keyboard.down('Control');
  for (let i = 0; Date.now() < until - SAMPLE_MS; i++) {
    await page.mouse.wheel(0, Math.floor(i / 15) % 2 ? 40 : -40);
  }
  await page.keyboard.up('Control');
}

async function touch(cdp: CDPSession, points: { x: number; y: number }[]) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [points[0]] });
  for (const point of points.slice(1)) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function swipe(page: Page, cdp: CDPSession, until: number) {
  const size = page.viewportSize()!;
  for (let round = 0; Date.now() < until - SAMPLE_MS; round++) {
    const sign = round % 2 ? 1 : -1;
    const from = { x: size.width * 0.6, y: size.height * (round % 2 ? 0.3 : 0.7) };
    await touch(cdp, Array.from({ length: 11 }, (_, s) => ({ x: from.x - s * 12 * sign, y: from.y - s * 25 * sign })));
  }
}

async function pinch(page: Page, cdp: CDPSession, until: number) {
  const size = page.viewportSize()!;
  const centre = { x: size.width / 2, y: size.height / 2 };
  for (let round = 0; Date.now() < until - SAMPLE_MS; round++) {
    const steps = Array.from({ length: 10 }, (_, s) => 40 + (round % 2 ? 10 - s : s) * 10);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: centre.x - steps[0], y: centre.y, id: 1 }, { x: centre.x + steps[0], y: centre.y, id: 2 }] });
    for (const d of steps.slice(1)) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: centre.x - d, y: centre.y, id: 1 }, { x: centre.x + d, y: centre.y, id: 2 }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
}

async function open(page: Page, cdp: CDPSession, path: string, slowdown: number): Promise<number> {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: slowdown });
  const started = Date.now();
  await page.goto(path);
  await expect(page.getByTestId('motion-node').first()).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('[data-testid="motion-node"] img')].every((img) => img.complete), null, { timeout: 60_000 });
  return Date.now() - started;
}

function report(name: string, value: Report) {
  console.log(`[canvas-perf] ${name} ${JSON.stringify(value)}`);
}

test.describe('a heavy canvas of motion nodes stays smooth @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.setTimeout(300_000);
  test.use({
    storageState: {
      cookies: [{ name: CONSENT_COOKIE, value: encodeConsent({ version: CONSENT_VERSION, at: 0, analytics: false, marketing: false }), domain: 'localhost', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' }],
      origins: []
    }
  });

  test.beforeEach(async ({ session, admin, seedNode, page }) => {
    const seeds = SOURCE ? recordedSeeds(SOURCE) : await syntheticSeeds();
    for (const seed of seeds) {
      const path = `${session.orgId}/${session.projectId}/${crypto.randomUUID()}.jpg`;
      expect((await admin.storage.from('canvas-assets').upload(path, seed.poster, { contentType: 'image/jpeg' })).error).toBeNull();
      const asset = await admin.from('assets').insert({ org_id: session.orgId, project_id: session.projectId, type: 'image', source: 'upload', url: path, mime_type: 'image/jpeg' }).select('id').single();
      expect(asset.error).toBeNull();
      const node = await seedNode({ type: 'motion', x: seed.x, y: seed.y, data: { format: seed.format, docHeadRevision: 1, posterAssetId: asset.data!.id, lastRenderAssetId: null } });
      const revision = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: seed.doc, actor_kind: 'user', actor_id: session.userId });
      expect(revision.error).toBeNull();
    }
    await page.addInitScript(instrument);
  });

  test('desktop: no player runs until play is pressed, and pan and zoom stay fluid', async ({ page, session }) => {
    await page.setViewportSize(DESKTOP);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    const loadMs = await open(page, cdp, `/p/${session.projectId}/c/${session.canvasId}`, 1);
    await page.waitForTimeout(SETTLE_MS);

    const afterLoad = await live(page);
    const pan = await during(page, PAN_MS, (until) => sweep(page, until));
    const zoomed = await during(page, ZOOM_MS, (until) => zoom(page, until));
    report('desktop', { loadMs, afterLoad, pan, zoom: zoomed, ...(await heapAndDom(cdp)) });

    expect(afterLoad.players).toBe(0);
    expect(afterLoad.webgl).toBe(0);
    expect(pan.peakPlayers).toBe(0);
    expect(pan.fpsAvg).toBeGreaterThanOrEqual(DESKTOP_MIN_FPS);

    await open(page, cdp, `/p/${session.projectId}/c/${session.canvasId}`, 1);
    const node = page.getByTestId('motion-node').first();
    await node.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.locator('[data-testid="motion-node"] hyperframes-player')).toHaveCount(1, { timeout: 15_000 });
    await node.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(page.locator('[data-testid="motion-node"] hyperframes-player')).toHaveCount(0);
  });

  test('phone at 4x CPU: swiping and pinching start no player', async ({ page, session }) => {
    await page.setViewportSize(PHONE);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const loadMs = await open(page, cdp, `/p/${session.projectId}/c/${session.canvasId}`, PHONE_CPU_SLOWDOWN);
    await page.waitForTimeout(SETTLE_MS);

    const afterLoad = await live(page);
    const pan = await during(page, PAN_MS, (until) => swipe(page, cdp, until));
    const zoomed = await during(page, ZOOM_MS, (until) => pinch(page, cdp, until));
    const memory = await heapAndDom(cdp);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    report('phone', { loadMs, afterLoad, pan, zoom: zoomed, ...memory });

    expect(afterLoad.players).toBe(0);
    expect(pan.peakPlayers).toBe(0);
    expect(pan.fpsAvg).toBeGreaterThanOrEqual(PHONE_MIN_FPS);
  });
});
