import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import type { HarnessNode } from './fixtures/motion-canvas-harness';

type Frames = { fpsAvg: number; fpsP5: number; p50: number; p95: number; max: number; over8: number; over17: number; over33: number; frames: number; workP95: number };
type Idle = { appFrames: number; infinite: string[]; mutations: number };

const HOST_PAGE = '/changelog';
const HARNESS = '/tests/e2e/fixtures/motion-canvas-harness.ts';
const SOURCE = process.env.CANVAS_PERF_SOURCE;
const DESKTOP = { width: 1440, height: 900 };
const SETTLE_MS = 3000;
const SWEEP_MS = 6000;
const IDLE_MS = 10_000;
const PRO_MOTION_MS = 1000 / 120;
const DISPLAY_MS = 1000 / 60;
const DROPPED_MS = 1000 / 30;
const MIN_FPS_AVG = 55;
const MIN_FPS_P5 = 45;
const IDLE_FRAMES_TOLERANCE = 2;
const COLUMNS = 4;
const STEP = { x: 520, y: 640 };
const NODES = 23;
const FORMATS = ['16:9', '9:16', '1:1', '4:5'];
const POSTER_WIDTH = 1080;
const ASPECT: Record<string, number> = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5 };

async function poster(format: string, seed: number): Promise<string> {
  const height = Math.round(POSTER_WIDTH / ASPECT[format]);
  const image = await sharp({ create: { width: POSTER_WIDTH, height, channels: 3, background: '#000', noise: { type: 'gaussian', mean: 60 + seed * 7, sigma: 40 } } }).jpeg().toBuffer();
  return `data:image/jpeg;base64,${image.toString('base64')}`;
}

async function syntheticCanvas(): Promise<HarnessNode[]> {
  return Promise.all(
    Array.from({ length: NODES }, async (_, i) => {
      const format = FORMATS[i % FORMATS.length];
      return { id: `n${i}`, x: (i % COLUMNS) * STEP.x, y: Math.floor(i / COLUMNS) * STEP.y, format, poster: await poster(format, i) };
    })
  );
}

function recordedCanvas(path: string): HarnessNode[] {
  const rows = JSON.parse(readFileSync(path, 'utf8')) as { x: number; y: number; data: { format: string }; poster: string }[];
  return rows.map((r, i) => ({ id: `n${i}`, x: Number(r.x), y: Number(r.y), format: r.data.format, poster: `data:image/jpeg;base64,${r.poster}` }));
}

const instrument = () => {
  type Probe = { gaps: number[]; work: number[]; counting: boolean; appFrames: number; mutations: number };
  const probe: Probe = { gaps: [], work: [], counting: false, appFrames: 0, mutations: 0 };
  (window as unknown as { __frames: Probe }).__frames = probe;

  const native = window.requestAnimationFrame.bind(window);
  const channel = new MessageChannel();
  let frameStart = 0;
  channel.port1.onmessage = () => {
    if (probe.counting) {
      probe.work.push(performance.now() - frameStart);
    }
  };
  let last = 0;
  const tick = (now: number) => {
    if (probe.counting && last) {
      probe.gaps.push(now - last);
      frameStart = performance.now();
      channel.port2.postMessage(0);
    }
    last = now;
    native(tick);
  };
  native(tick);

  window.requestAnimationFrame = (callback: FrameRequestCallback) =>
    native((now) => {
      probe.appFrames += 1;
      callback(now);
    });

  new MutationObserver((records) => {
    probe.mutations += records.length;
  }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
};

async function measure(page: Page, ms: number, gesture: (until: number) => Promise<void>): Promise<Frames> {
  await page.evaluate(() => Object.assign((window as unknown as { __frames: object }).__frames, { gaps: [], work: [], counting: true }));
  await gesture(Date.now() + ms);
  const { gaps, work } = await page.evaluate(() => {
    const probe = (window as unknown as { __frames: { gaps: number[]; work: number[]; counting: boolean } }).__frames;
    probe.counting = false;
    return { gaps: [...probe.gaps].sort((a, b) => a - b), work: [...probe.work].sort((a, b) => a - b) };
  });
  const at = (list: number[], share: number) => list[Math.min(list.length - 1, Math.floor(list.length * share))] ?? 0;
  const mean = gaps.reduce((sum, g) => sum + g, 0) / Math.max(1, gaps.length);
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    fpsAvg: Math.round(1000 / mean),
    fpsP5: Math.round(1000 / at(gaps, 0.95)),
    p50: round(at(gaps, 0.5)),
    p95: round(at(gaps, 0.95)),
    max: round(gaps.at(-1) ?? 0),
    over8: gaps.filter((g) => g > PRO_MOTION_MS + 0.5).length,
    over17: gaps.filter((g) => g > DISPLAY_MS + 1).length,
    over33: gaps.filter((g) => g > DROPPED_MS + 1).length,
    frames: gaps.length,
    workP95: round(at(work, 0.95))
  };
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

async function pan(page: Page, until: number) {
  const size = page.viewportSize()!;
  await page.mouse.move(size.width / 2, size.height / 2);
  for (let i = 0; Date.now() < until; i++) {
    const t = i / 10;
    await page.mouse.wheel(Math.sin(t) * 120, Math.cos(t * 0.7) * 120);
  }
}

async function zoom(page: Page, until: number) {
  const size = page.viewportSize()!;
  await page.mouse.move(size.width / 2, size.height / 2);
  await page.keyboard.down('Control');
  for (let i = 0; Date.now() < until; i++) {
    await page.mouse.wheel(0, Math.floor(i / 8) % 2 ? 60 : -60);
  }
  await page.keyboard.up('Control');
}

function report(name: string, value: unknown) {
  console.log(`[canvas-frame-budget] ${test.info().project.name} ${name} ${JSON.stringify(value)}`);
}

test.describe('the canvas spends frames only on motion @perf', () => {
  test.skip(!process.env.E2E_PERF, 'misura frame su questa macchina: E2E_PERF=1');
  test.setTimeout(120_000);
  test.use({ viewport: DESKTOP });

  test('fast pan and zoom hold the frame budget, and an idle canvas draws nothing', async ({ page }) => {
    const nodes = SOURCE ? recordedCanvas(SOURCE) : await syntheticCanvas();
    await page.addInitScript(instrument);
    await page.goto(HOST_PAGE);
    await page.evaluate((path) => import(path), HARNESS);
    await page.evaluate((list) => window.motionCanvas.mount(list), nodes);
    await expect(page.getByTestId('motion-node').first()).toBeVisible();

    const quiet = await idle(page);
    const panned = await measure(page, SWEEP_MS, (until) => pan(page, until));
    const zoomed = await measure(page, SWEEP_MS, (until) => zoom(page, until));
    report('pan', panned);
    report('zoom', zoomed);
    report('idle', quiet);

    for (const [name, frames] of [['pan', panned], ['zoom', zoomed]] as const) {
      expect(frames.fpsAvg, `${name} average fps`).toBeGreaterThanOrEqual(MIN_FPS_AVG);
      expect(frames.fpsP5, `${name} 5th-percentile fps`).toBeGreaterThanOrEqual(MIN_FPS_P5);
    }
    expect(quiet.infinite, 'no endless animation while idle').toEqual([]);
    expect(quiet.appFrames, 'no animation frame while idle').toBeLessThanOrEqual(IDLE_FRAMES_TOLERANCE);
  });
});
