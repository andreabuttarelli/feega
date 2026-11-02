import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CDPSession, Page } from '@playwright/test';
import { test as base, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { instrument, measure, wheelPan, type Frames } from './fixtures/frame-sweeps';
import { landingDoc } from '../../packages/motion-core/src/motion/codegen/fixtures/landing';

const LABEL = process.env.BENCH_LABEL ?? 'run';
const NO_WEBGPU = process.env.BENCH_WEBGL === '1';
const OUT = process.env.CANVAS_BENCH_OUT ?? join(homedir(), 'Documents', 'feega-videos', 'perf');
const VIEWPORT = { width: 1779, height: 1116 };
const DPR = 1.7;
const LANDING = { width: 1440, height: 4480 };
const LANDING_DATA = { format: 'custom', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SURFACE = '[data-canvas-surface]';
const TILE = '[data-testid="gpu-node"]';
const OPEN_DEADLINE_MS = 60_000;
const SETTLE_MS = 6000;
const ADOPT_MS = 12_000;
const ZOOM_STEPS = 20;
const ZOOM_DELTA = 8;
const STEP_DEADLINE_MS = 5000;
const PAN_MS = 3000;
const SELECT_DEADLINE_MS = 5000;
const MODE_PAUSE_MS = 1500;
const MODES = ['motion', 'play', 'design'];
const MB = 1024 * 1024;
const LAYERS = 'nav[data-dock="left-bar"] button[aria-label="Layers"]';
const LANDING_LAYER = 'Ledgerline landing';
const OWN_FETCH = /\/api\/[^?]*\/frame-outlines/;

const BUDGET = { longestTaskMs: 2000, heapMb: 500, zoomStepMs: 1000 };

const STYLES = {
  'Heading XL': { kind: 'text', font: 'Inter', size: 0.05, weight: 600, tracking: -0.03, leading: 1.1, color: '#0e1116' },
  Body: { kind: 'text', font: 'Inter', size: 0.012, weight: 400, leading: 1.55, color: '#3d4451' },
  Eyebrow: { kind: 'text', font: 'JetBrains Mono', size: 0.009, weight: 600, tracking: 0.08, textCase: 'upper', color: '#1f5eff' },
  Brand: { kind: 'colour', color: '#1f5eff' },
  Ink: { kind: 'colour', color: '#0e1116' }
};

type Step = { ms: number; zoom: number | null };
type LongTask = { at: number; ms: number };

const watchLongTasks = () => {
  const seen: LongTask[] = [];
  (window as unknown as { __long: LongTask[] }).__long = seen;
  new PerformanceObserver((list) => list.getEntries().forEach((e) => seen.push({ at: Math.round(e.startTime), ms: Math.round(e.duration) }))).observe({ type: 'longtask', buffered: true });
};

const hideBanner = () =>
  addEventListener('DOMContentLoaded', () => document.head.append(Object.assign(document.createElement('style'), { textContent: '[data-testid="cookie-banner"]{display:none!important}' })));

const hideWebGpu = () => Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true });

const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(hideBanner);
    await use(context);
  }
});

const heapMb = async (cdp: CDPSession) => {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return Math.round((metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0) / MB);
};

const hud = (page: Page) => page.evaluate(() => document.querySelector('.core-hud')?.textContent ?? '');

const zoomOf = (text: string) => {
  const found = /zoom=([\d.]+) view/.exec(text);
  return found ? Number(found[1]) : null;
};

const nextFrame = (page: Page) => page.evaluate((deadline) => Promise.race([new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), new Promise((r) => setTimeout(r, deadline))]), STEP_DEADLINE_MS);

async function fit(page: Page) {
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Shift+Digit1');
  await page.waitForTimeout(MODE_PAUSE_MS);
}

async function wheelSteps(page: Page, delta: number): Promise<Step[]> {
  const steps: Step[] = [];
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
  await page.keyboard.down('Control');
  for (let i = 0; i < ZOOM_STEPS; i++) {
    const started = Date.now();
    await page.mouse.wheel(0, delta);
    await nextFrame(page);
    steps.push({ ms: Date.now() - started, zoom: zoomOf(await hud(page)) });
  }
  await page.keyboard.up('Control');
  return steps;
}

async function zoomInOut(page: Page) {
  const before = zoomOf(await hud(page));
  let steps: Step[] = [];
  const frames = await measure(page, 0, async () => {
    steps = [...(await wheelSteps(page, -ZOOM_DELTA)), ...(await wheelSteps(page, ZOOM_DELTA))];
  });
  const deepest = Math.max(...steps.slice(0, ZOOM_STEPS).map((s) => s.zoom ?? 0));
  return { frames, before, deepest, stepMaxMs: Math.max(...steps.map((s) => s.ms)) };
}

async function selectMs(page: Page): Promise<number | null> {
  const box = await page.locator(TILE).first().boundingBox();
  if (!box) {
    return null;
  }
  const started = Date.now();
  await page.mouse.click(box.x + Math.min(box.width / 2, 40), box.y + Math.min(box.height / 2, 40));
  const shown = await page
    .getByTestId('frame-selection')
    .first()
    .waitFor({ timeout: SELECT_DEADLINE_MS })
    .then(() => true)
    .catch(() => false);
  return shown ? Date.now() - started : null;
}

async function switchMode(page: Page, mode: string): Promise<number | null> {
  const button = page.locator(`[data-testid="editor-mode-switch"] :is(button[data-mode="${mode}"], [role="radio"][data-value="${mode}"])`).first();
  if (!(await button.count())) {
    return null;
  }
  const started = Date.now();
  await button.click({ timeout: STEP_DEADLINE_MS });
  await nextFrame(page);
  return Date.now() - started;
}

async function enterLanding(page: Page) {
  const box = await page.locator(TILE).first().boundingBox();
  if (!box) {
    return;
  }
  const at = { x: box.x + box.width / 2, y: box.y + Math.min(box.height / 2, 200) };
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(MODE_PAUSE_MS / 2);
  await page.mouse.dblclick(at.x, at.y);
  await page.waitForTimeout(SETTLE_MS / 2);
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(MODE_PAUSE_MS);
}

test.use({ deviceScaleFactor: DPR, viewport: VIEWPORT });

test.describe('a styled landing canvas stays responsive after it reopens @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(300_000);

  test('reopen, zoom, pan, select, switch modes, edit inside', async ({ page, session, admin }) => {
    const errors: string[] = [];
    let crashed = false;
    page.on('pageerror', (e) => errors.push(e.message.slice(0, 300)));
    page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text().slice(0, 300)));
    page.on('crash', () => (crashed = true));
    const layersFetches: string[] = [];
    page.on('request', (r) => OWN_FETCH.test(r.url()) && layersFetches.push(r.url()));
    await page.addInitScript(instrument);
    await page.addInitScript(watchLongTasks);
    if (NO_WEBGPU) {
      await page.addInitScript(hideWebGpu);
    }

    const id = randomUUID();
    const row = { id, org_id: session.orgId, project_id: session.projectId, canvas_id: session.canvasId, actor_kind: 'user', actor_id: session.userId, type: 'motion', x: 0, y: 0, data: LANDING_DATA, ...LANDING };
    expect((await admin.from('nodes').insert(row)).error).toBeNull();
    expect((await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: id, version: 1, doc: { ...landingDoc(), styles: STYLES }, actor_kind: 'user', actor_id: session.userId })).error).toBeNull();

    const canvasUrl = `/p/${session.projectId}/c/${session.canvasId}?coreDebug`;
    await gotoHydrated(page, canvasUrl);
    await page.locator(TILE).first().waitFor({ timeout: OPEN_DEADLINE_MS });
    await page.waitForTimeout(ADOPT_MS);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    const started = Date.now();
    await gotoHydrated(page, canvasUrl);
    await page.locator(SURFACE).first().waitFor({ timeout: OPEN_DEADLINE_MS });
    await page.locator(TILE).first().waitFor({ timeout: OPEN_DEADLINE_MS });
    const reopenMs = Date.now() - started;
    await page.locator(LAYERS).click();
    await page.waitForTimeout(SETTLE_MS);
    const backend = await page.evaluate(() => ('gpu' in navigator && navigator.gpu ? 'webgpu' : 'webgl'));
    const heapAtOpen = await heapMb(cdp);

    await fit(page);
    const zoom = await zoomInOut(page);
    await fit(page);
    const pan: Frames = await measure(page, PAN_MS, (until) => wheelPan(page, until));
    await fit(page);
    const select = await selectMs(page);
    const modes: Record<string, number | null> = {};
    for (const mode of MODES) {
      modes[mode] = await switchMode(page, mode);
      await page.waitForTimeout(MODE_PAUSE_MS);
    }
    await fit(page);
    await enterLanding(page);
    const inside = await zoomInOut(page);
    await page.waitForTimeout(SETTLE_MS / 2);

    const layersShowLanding = await page.getByTestId('pages-layers').getByText(LANDING_LAYER, { exact: true }).first().isVisible();
    const long = await page.evaluate(() => (window as unknown as { __long: LongTask[] }).__long);
    const result = {
      label: LABEL,
      backend,
      reopenMs,
      longestTaskMs: Math.max(0, ...long.map((t) => t.ms)),
      longTaskMs: long.reduce((sum, t) => sum + t.ms, 0),
      heapMb: { open: heapAtOpen, end: await heapMb(cdp) },
      zoom,
      pan,
      selectMs: select,
      modes,
      inside,
      hud: await hud(page),
      errors,
      crashed,
      layersFetches: layersFetches.length,
      layersShowLanding
    };
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, `landing-session-${LABEL}-${backend}.json`), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));

    expect(crashed).toBe(false);
    expect(errors, 'no uncaught error, no effect loop').toEqual([]);
    expect(result.longestTaskMs, 'no main-thread task blocks the reopened canvas').toBeLessThan(BUDGET.longestTaskMs);
    expect(heapAtOpen).toBeLessThan(BUDGET.heapMb);
    expect(zoom.deepest, 'ctrl+wheel zooms in').toBeGreaterThan(zoom.before ?? Infinity);
    expect(zoom.stepMaxMs).toBeLessThan(BUDGET.zoomStepMs);
    expect(inside.stepMaxMs).toBeLessThan(BUDGET.zoomStepMs);
    expect(layersFetches, 'Layers reads what the canvas loaded, never a fetch of its own').toEqual([]);
    expect(layersShowLanding, 'Layers lists the elements of the loaded landing').toBe(true);
  });
});
