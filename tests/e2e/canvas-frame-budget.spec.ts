import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import type { HarnessNode } from './fixtures/motion-canvas-harness';
import { dragFrom, instrument, measure, wheelPan as pan, wheelZoom as zoom } from './fixtures/frame-sweeps';

type Idle = { appFrames: number; infinite: string[]; mutations: number };

const HOST_PAGE = '/changelog';
const HARNESS = '/tests/e2e/fixtures/motion-canvas-harness.ts';
const SOURCE = process.env.CANVAS_PERF_SOURCE;
const MEDIA = process.env.CANVAS_PERF_MEDIA ?? 'image';
const THROTTLE = Number(process.env.CANVAS_PERF_THROTTLE ?? 1);
const DESKTOP = { width: 1440, height: 900 };
const SETTLE_MS = 3000;
const SWEEP_MS = 6000;
const IDLE_MS = 10_000;
const MIN_FPS_AVG = 55;
const MIN_FPS_P5 = 45;
const IDLE_FRAMES_TOLERANCE = 2;
const STEP = { x: 520, y: 640 };
const NODE_COUNTS = (process.env.CANVAS_PERF_NODES ?? '50,200,500').split(',').map(Number);
const CLOSE_ZOOM_STEPS = 8;
const SELECTIONS = 10;
const FORMATS = ['16:9', '9:16', '1:1', '4:5'];
const POSTER_WIDTH = 1080;
const ASPECT: Record<string, number> = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5 };

function clip(format: string, seed: number): string {
  const height = Math.round(POSTER_WIDTH / ASPECT[format] / 2) * 2;
  const source = `testsrc2=s=${POSTER_WIDTH}x${height}:d=2:r=30,hue=h=${seed * 40}`;
  const webm = execFileSync('ffmpeg', ['-loglevel', 'error', '-f', 'lavfi', '-i', source, '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-f', 'webm', 'pipe:1'], { maxBuffer: 256 * 1024 * 1024 });
  return `data:video/webm;base64,${webm.toString('base64')}`;
}

async function poster(format: string, seed: number): Promise<string> {
  if (MEDIA.startsWith('video')) {
    return clip(format, seed);
  }
  const height = Math.round(POSTER_WIDTH / ASPECT[format]);
  const image = await sharp({ create: { width: POSTER_WIDTH, height, channels: 3, background: '#000', noise: { type: 'gaussian', mean: 60 + seed * 7, sigma: 40 } } }).jpeg().toBuffer();
  return `data:image/jpeg;base64,${image.toString('base64')}`;
}

async function syntheticCanvas(count: number): Promise<HarnessNode[]> {
  const posters = await Promise.all(FORMATS.map((format, i) => poster(format, i)));
  const columns = Math.ceil(Math.sqrt(count));
  return Array.from({ length: count }, (_, i) => {
    const format = FORMATS[i % FORMATS.length];
    return { id: `n${i}`, x: (i % columns) * STEP.x, y: Math.floor(i / columns) * STEP.y, format, poster: posters[i % FORMATS.length], source: MEDIA };
  });
}

function recordedCanvas(path: string): HarnessNode[] {
  const rows = JSON.parse(readFileSync(path, 'utf8')) as { x: number; y: number; data: { format: string }; poster: string }[];
  return rows.map((r, i) => ({ id: `n${i}`, x: Number(r.x), y: Number(r.y), format: r.data.format, poster: `data:image/jpeg;base64,${r.poster}` }));
}

async function idle(page: Page): Promise<Idle> {
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(() => Object.assign((window as unknown as { __frames: object }).__frames, { appFrames: 0, mutations: 0 }));
  await page.waitForTimeout(IDLE_MS);
  return page.evaluate(() => {
    const probe = (window as unknown as { __frames: { appFrames: number; mutations: number } }).__frames;
    const infinite = document
      .getAnimations()
      .filter((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations === Infinity)
      .map((a) => `${(a as CSSAnimation).animationName ?? 'animation'}`);
    return { appFrames: probe.appFrames, infinite, mutations: probe.mutations };
  });
}

type Churn = { nodesTouched: number; perNodeMax: number; perNodeMean: number; selectionEmits: number; mounted: number };

async function churn(page: Page, gesture: () => Promise<void>): Promise<Churn> {
  await page.evaluate(() => {
    (window as unknown as { __frames: { perNode: object } }).__frames.perNode = {};
    window.selectionEmits = 0;
  });
  await gesture();
  return page.evaluate(() => {
    const counts = Object.values((window as unknown as { __frames: { perNode: Record<string, number> } }).__frames.perNode);
    const total = counts.reduce((sum, n) => sum + n, 0);
    return {
      nodesTouched: counts.length,
      perNodeMax: Math.max(0, ...counts),
      perNodeMean: Math.round((total / Math.max(1, counts.length)) * 10) / 10,
      selectionEmits: window.selectionEmits ?? 0,
      mounted: document.querySelectorAll('.svelte-flow__node').length
    };
  });
}

async function zoomIn(page: Page) {
  const size = page.viewportSize()!;
  await page.mouse.move(size.width / 2, size.height / 2);
  await page.keyboard.down('Control');
  for (let i = 0; i < CLOSE_ZOOM_STEPS; i++) {
    await page.mouse.wheel(0, -100);
  }
  await page.keyboard.up('Control');
  await page.waitForTimeout(500);
}

async function onScreen(page: Page): Promise<{ x: number; y: number; width: number; height: number }[]> {
  const size = page.viewportSize()!;
  const boxes = await page.getByTestId('motion-node').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
  const inside = (x: number, y: number) => x > 0 && y > 0 && x < size.width && y < size.height;
  return boxes.filter((b) => inside(b.x + b.width / 2, b.y + b.height / 2));
}

async function drag(page: Page) {
  const [box] = await onScreen(page);
  await dragFrom(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
}

async function selectEach(page: Page) {
  const boxes = (await onScreen(page)).slice(0, SELECTIONS);
  for (const box of boxes) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
}

function report(name: string, value: unknown) {
  console.log(`[canvas-frame-budget] ${test.info().project.name} ${name} ${JSON.stringify(value)}`);
}

test.describe('the canvas spends frames only on motion @perf', () => {
  test.skip(!process.env.E2E_PERF, 'misura frame su questa macchina: E2E_PERF=1');
  test.setTimeout(300_000);
  test.use({ viewport: DESKTOP });

  for (const count of NODE_COUNTS) {
    test(`${count} nodes: pan, zoom and drag hold the frame budget, and an idle canvas draws nothing`, async ({ page, browserName }) => {
      const nodes = SOURCE ? recordedCanvas(SOURCE) : await syntheticCanvas(count);
      await page.addInitScript(instrument);
      if (THROTTLE > 1 && browserName === 'chromium') {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
      }
      await page.goto(HOST_PAGE);
      await page.evaluate((path) => import(path), HARNESS);
      const posters = [...new Set(nodes.map((n) => n.poster))];
      const compact = nodes.map((n) => ({ ...n, poster: String(posters.indexOf(n.poster)) }));
      const mount = async () => {
        await page.evaluate(({ list, art }) => window.motionCanvas.mount(list.map((n) => ({ ...n, poster: art[Number(n.poster)] }))), { list: compact, art: posters });
        await expect(page.locator('.svelte-flow__node').first()).toBeVisible();
        await page.waitForTimeout(SETTLE_MS);
      };
      await mount();

      const quiet = await idle(page);
      const overviewPan = await measure(page, SWEEP_MS, (until) => pan(page, until));
      const zoomed = await measure(page, SWEEP_MS, (until) => zoom(page, until));
      await mount();
      await zoomIn(page);
      const closePan = await measure(page, SWEEP_MS, (until) => pan(page, until));
      await mount();
      const panChurn = await churn(page, () => pan(page, Date.now() + 1500));
      await mount();
      const dragged = await measure(page, 0, () => drag(page));
      const dragChurn = await churn(page, () => drag(page));
      const selectChurn = await churn(page, () => selectEach(page));
      report(`${count} pan-overview`, overviewPan);
      report(`${count} zoom`, zoomed);
      report(`${count} pan-close`, closePan);
      report(`${count} drag`, dragged);
      report(`${count} churn-pan`, panChurn);
      report(`${count} churn-drag`, dragChurn);
      report(`${count} churn-select`, selectChurn);
      report(`${count} idle`, quiet);

      test.skip(THROTTLE > 1, 'throttled runs report, they do not gate');
      for (const [name, frames] of [['pan-overview', overviewPan], ['zoom', zoomed], ['pan-close', closePan]] as const) {
        expect(frames.fpsAvg, `${name} average fps`).toBeGreaterThanOrEqual(MIN_FPS_AVG);
        expect(frames.fpsP5, `${name} 5th-percentile fps`).toBeGreaterThanOrEqual(MIN_FPS_P5);
      }
      expect(dragged.fpsAvg, 'drag average fps').toBeGreaterThanOrEqual(MIN_FPS_AVG);
      expect(quiet.infinite, 'no endless animation while idle').toEqual([]);
      expect(quiet.appFrames, 'no animation frame while idle').toBeLessThanOrEqual(IDLE_FRAMES_TOLERANCE);
    });
  }
});
