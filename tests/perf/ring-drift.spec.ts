import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, chromium, type Page } from '@playwright/test';
import { ZOOM_FIXTURE_PLACE } from '../../scripts/perf/zoom-fixture.mjs';

type Box = { x: number; y: number; w: number; h: number };
type Camera = { x: number; y: number; zoom: number };
type Sample = { camera: Camera; rings: Record<string, Box> };
type Fit = { cx: number; cy: number; w: number; h: number; pw: number; ph: number };

const VIEWPORT = { width: 1440, height: 900 };
const DPR = 2;
const LOCAL_USER_ID = '00000000-0000-4000-8000-00000000f002';
const VIEW_KEY = `feega:viewport:${LOCAL_USER_ID}:${ZOOM_FIXTURE_PLACE.canvasId}`;
const START_VIEW = { x: 120, y: 140, zoom: 0.5 };
const SETTLE_MS = 6000;
const WHEEL_STEPS = 40;
const ZOOM_CAP = 1.1;
const WHEEL_DELTA = -4;
const WHEEL_GAP_MS = 16;
const MAX_DRIFT_DEVICE_PX = 1;
const PROBE_GRID = 8;
const MAX_SHARE = 0.4;
const OUT = process.env.BENCH_OUT ?? 'perf-results';
const SHOTS = process.env.RING_SHOTS === '1';
const SHOT_EVERY = 3;
const DOM_RINGS = ['frame-selection', 'frame-group-selection', 'frame-pick-box', 'view-pick-box', 'frame-layer-hover-box', 'tile-selection', 'node-hover-ring'];
const CI_GPU_ARGS = ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader', '--enable-features=Vulkan', '--ignore-gpu-blocklist'];

function startSampling(page: Page, domRings: string[]) {
  return page.evaluate((testIds) => {
    const w = window as unknown as { __ringSamples: unknown[]; __ringStop: boolean; __gpuCanvas?: { frames?: { camera?: Camera }[]; marks?: { ids: () => string[]; rectOf: (id: string) => Box | null } } };
    w.__ringSamples = [];
    w.__ringStop = false;
    const surface = document.querySelector('[data-canvas-surface]') as HTMLElement;
    const pane = document.querySelector('.svelte-flow__pane')!.getBoundingClientRect();
    const currentView = (): Camera => {
      const [x, y, zoom] = surface.dataset.view!.split(',').map(Number);
      return { x, y, zoom };
    };
    const sample = () => {
      const marks = w.__gpuCanvas?.marks;
      const rings: Record<string, Box> = {};
      if (marks) {
        for (const id of marks.ids()) {
          const r = marks.rectOf(id);
          if (r) {
            rings[id] = { x: pane.x + r.x, y: pane.y + r.y, w: r.w, h: r.h };
          }
        }
        w.__ringSamples.push({ camera: currentView(), rings });
        return;
      }
      for (const testId of testIds) {
        document.querySelectorAll(`[data-testid="${testId}"]`).forEach((el, i) => {
          const r = el.getBoundingClientRect();
          rings[`${testId}#${i}`] = { x: r.x, y: r.y, w: r.width, h: r.height };
        });
      }
      const presented = w.__gpuCanvas?.frames?.at(-1)?.camera ?? currentView();
      w.__ringSamples.push({ camera: presented, rings });
    };
    const tick = () => {
      setTimeout(sample, 0);
      if (!w.__ringStop) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
    return { x: pane.x, y: pane.y };
  }, domRings);
}

async function stopSampling(page: Page): Promise<Sample[]> {
  return page.evaluate(() => {
    const w = window as unknown as { __ringSamples: Sample[]; __ringStop: boolean };
    w.__ringStop = true;
    return w.__ringSamples;
  });
}

async function restSample(page: Page): Promise<Sample> {
  await startSampling(page, DOM_RINGS);
  await page.waitForTimeout(300);
  return (await stopSampling(page)).at(-1)!;
}

function fit(pane: { x: number; y: number }, a: { box: Box; camera: Camera }, b: { box: Box; camera: Camera }): Fit {
  const centre = (s: { box: Box; camera: Camera }) => ({ x: (s.box.x + s.box.w / 2 - pane.x - s.camera.x) / s.camera.zoom, y: (s.box.y + s.box.h / 2 - pane.y - s.camera.y) / s.camera.zoom });
  const c = centre(a);
  const dz = b.camera.zoom - a.camera.zoom;
  const w = (b.box.w - a.box.w) / dz;
  const h = (b.box.h - a.box.h) / dz;
  return { cx: c.x, cy: c.y, w, h, pw: a.box.w - w * a.camera.zoom, ph: a.box.h - h * a.camera.zoom };
}

function drift(pane: { x: number; y: number }, f: Fit, box: Box, camera: Camera): number {
  const ex = pane.x + camera.x + f.cx * camera.zoom;
  const ey = pane.y + camera.y + f.cy * camera.zoom;
  const ew = f.w * camera.zoom + f.pw;
  const eh = f.h * camera.zoom + f.ph;
  const left = Math.abs(box.x - (ex - ew / 2));
  const top = Math.abs(box.y - (ey - eh / 2));
  const right = Math.abs(box.x + box.w - (ex + ew / 2));
  const bottom = Math.abs(box.y + box.h - (ey + eh / 2));
  return Math.max(left, top, right, bottom) * DPR;
}

const SELECTED = (id: string) => id.startsWith('pick:') || id.startsWith('frame-selection');
const HOVERED = (id: string) => id.startsWith('hover:') || id.startsWith('frame-pick-box');

async function smallRing(page: Page, kind: (id: string) => boolean, frameWidth: number): Promise<boolean> {
  const { rings } = await restSample(page);
  return Object.entries(rings).some(([id, b]) => kind(id) && b.w > 4 && b.w < frameWidth * MAX_SHARE);
}

async function pickElement(page: Page): Promise<{ x: number; y: number }> {
  const frame = { x: START_VIEW.x, y: START_VIEW.y, w: 1920 * START_VIEW.zoom, h: 1080 * START_VIEW.zoom };
  await page.mouse.click(frame.x + frame.w / 2, frame.y + frame.h / 2);
  for (let i = 1; i < PROBE_GRID; i++) {
    for (let j = 1; j < PROBE_GRID; j++) {
      const at = { x: frame.x + (frame.w * i) / PROBE_GRID, y: frame.y + (frame.h * j) / PROBE_GRID };
      await page.mouse.dblclick(at.x, at.y);
      await page.waitForTimeout(150);
      if (await smallRing(page, SELECTED, frame.w)) {
        return at;
      }
    }
  }
  throw new Error('no element could be picked in the first frame');
}

async function hoverAnother(page: Page, picked: { x: number; y: number }): Promise<{ x: number; y: number }> {
  const frame = { x: START_VIEW.x, y: START_VIEW.y, w: 1920 * START_VIEW.zoom, h: 1080 * START_VIEW.zoom };
  for (let i = 1; i < PROBE_GRID; i++) {
    for (let j = 1; j < PROBE_GRID; j++) {
      const at = { x: frame.x + (frame.w * i) / PROBE_GRID, y: frame.y + (frame.h * j) / PROBE_GRID };
      if (Math.hypot(at.x - picked.x, at.y - picked.y) < 40) {
        continue;
      }
      await page.mouse.move(at.x, at.y);
      await page.waitForTimeout(120);
      if (await smallRing(page, HOVERED, frame.w)) {
        return at;
      }
    }
  }
  throw new Error('no second element lit a hover ring');
}

async function pacedZoom(page: Page, at: { x: number; y: number }) {
  await page.keyboard.down('Control');
  for (let i = 0; i < WHEEL_STEPS; i++) {
    const zoom = await page.locator('[data-canvas-surface]').first().evaluate((el) => Number((el as HTMLElement).dataset.view!.split(',')[2]));
    if (zoom >= ZOOM_CAP) {
      break;
    }
    await page.mouse.wheel(0, WHEEL_DELTA);
    if (SHOTS && i % SHOT_EVERY === 0) {
      writeFileSync(join(OUT, `mid-zoom-${String(i).padStart(2, '0')}.png`), await page.screenshot({ clip: { x: at.x - 360, y: at.y - 240, width: 720, height: 480 } }));
    }
    await page.waitForTimeout(WHEEL_GAP_MS);
  }
  await page.keyboard.up('Control');
  await page.mouse.move(at.x, at.y);
}

test('selection and hover rings hug their element every frame of a zoom', async ({ baseURL }) => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: false, args: process.env.CI ? CI_GPU_ARGS : ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: DPR, serviceWorkers: 'block', ...(SHOTS ? { recordVideo: { dir: OUT, size: VIEWPORT } } : {}), colorScheme: process.env.RING_THEME === 'dark' ? 'dark' : 'light' });
  const page = await context.newPage();
  page.on('console', (m) => /gpu|webgl|fallback|marks/i.test(m.text()) && console.log(`[page] ${m.text().slice(0, 200)}`));
  if (process.env.RING_BACKEND === 'webgl') {
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined }));
  }
  await page.addInitScript(({ key, view }) => localStorage.setItem(key, JSON.stringify(view)), { key: VIEW_KEY, view: START_VIEW });
  await page.goto(`${baseURL}/p/${ZOOM_FIXTURE_PLACE.projectId}/c/${ZOOM_FIXTURE_PLACE.canvasId}`, { waitUntil: 'commit' });
  await page.locator('[data-canvas-surface]').first().waitFor({ timeout: 120_000 });
  await page.waitForTimeout(SETTLE_MS);

  const picked = await pickElement(page);
  const hovered = await hoverAnother(page, picked);
  const before = await restSample(page);
  writeFileSync(join(OUT, 'ring-drift-before.png'), await page.screenshot());

  const pane = await startSampling(page, DOM_RINGS);
  await pacedZoom(page, hovered);
  const during = await stopSampling(page);
  await page.waitForTimeout(800);
  const after = await restSample(page);
  writeFileSync(join(OUT, 'ring-drift-after.png'), await page.screenshot());

  const report: Record<string, number> = {};
  for (const id of Object.keys(before.rings).filter((k) => after.rings[k])) {
    const f = fit(pane, { box: before.rings[id], camera: before.camera }, { box: after.rings[id], camera: after.camera });
    const drifts = during.filter((s) => s.rings[id]).map((s) => drift(pane, f, s.rings[id], s.camera));
    report[id] = Math.max(0, ...drifts);
  }
  const frames = during.length;
  writeFileSync(join(OUT, 'ring-drift.json'), JSON.stringify({ frames, zoom: [before.camera.zoom, after.camera.zoom], maxDriftDevicePx: report }, null, 2));
  console.log(`ring drift over ${frames} frames, zoom ${before.camera.zoom.toFixed(3)} → ${after.camera.zoom.toFixed(3)}: ${JSON.stringify(report)}`);
  await browser.close();

  expect(Object.keys(report).length, 'a selection and a hover ring were measured').toBeGreaterThanOrEqual(2);
  expect(Math.max(...Object.values(report)), 'ring drift in device px').toBeLessThanOrEqual(MAX_DRIFT_DEVICE_PX);
});
