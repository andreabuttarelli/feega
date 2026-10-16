import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { test, expect, type Page } from '@playwright/test';
import { LOD_CLASS, LOD_ZOOM } from '../../src/lib/canvas/poster-lod';

const HARNESS = '/tests/e2e/fixtures/motion-canvas-harness.ts';
const NODES = 300;
const COLUMNS = 18;
const STEP = { x: 520, y: 640 };
const RED = { r: 204, g: 51, b: 51 };
const PAN_STEPS = 6;
const ZOOM_IN_STEPS = 24;

const redImage = async () => `data:image/jpeg;base64,${(await sharp({ create: { width: 400, height: 400, channels: 3, background: RED } }).jpeg().toBuffer()).toString('base64')}`;

const RED_VIDEO = 'tests/e2e/fixtures/red-frame.webm';
const redVideo = () => `data:video/webm;base64,${readFileSync(RED_VIDEO).toString('base64')}`;

async function mountZoomedOut(page: Page, source = 'image') {
  const poster = source === 'video' ? redVideo() : await redImage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/changelog');
  await page.evaluate((path) => import(path), HARNESS);
  await page.evaluate(
    ({ art, source, count, columns, step }) =>
      window.motionCanvas.mount(Array.from({ length: count }, (_, i) => ({ id: `n${i}`, x: (i % columns) * step.x, y: Math.floor(i / columns) * step.y, format: '1:1', poster: art, source }))),
    { art: poster, source, count: NODES, columns: COLUMNS, step: STEP }
  );
  await expect(page.locator('.svelte-flow')).toHaveCount(1);
  await expect(page.locator('.moving')).toHaveCount(0);
}

const shellDisplays = (page: Page) => page.locator('.svelte-flow__node.has-poster').evaluateAll((nodes) => [...new Set(nodes.map((node) => getComputedStyle(node).display))]);

const redOnLayer = (page: Page) =>
  page.getByTestId('poster-layer').evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let red = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      red += pixels[i] > 150 && pixels[i + 1] < 100 ? 1 : 0;
    }
    return red;
  });

test('zoomed out, a video node is drawn by the poster layer from a paused frame', async ({ page }) => {
  await mountZoomedOut(page, 'video');

  await expect(page.locator('.svelte-flow.poster-lod')).toHaveCount(1);
  await expect.poll(() => redOnLayer(page)).toBeGreaterThan(0);
});

test('zoomed out, poster nodes are drawn by one canvas and their DOM stops painting', async ({ page }) => {
  await mountZoomedOut(page);

  await expect(page.locator('.svelte-flow.poster-lod')).toHaveCount(1);
  await expect(page.locator('.svelte-flow__node.has-poster').first().locator('> *').first()).toBeHidden();
  await expect
    .poll(() =>
      page.getByTestId('poster-layer').evaluate((canvas: HTMLCanvasElement) => {
        const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
        let red = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          red += pixels[i] > 150 && pixels[i + 1] < 100 ? 1 : 0;
        }
        return red;
      })
    )
    .toBeGreaterThan(0);
});

test('zoomed out no video element is mounted; zoomed in only the ones on screen are, and a playing one stays', async ({ page }) => {
  await mountZoomedOut(page, 'video');
  await expect(page.locator('.svelte-flow.poster-lod')).toHaveCount(1);
  await expect(page.locator('video')).toHaveCount(0);

  const first = (await page.locator('.svelte-flow__node').first().boundingBox())!;
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.keyboard.down('Control');
  for (let i = 0; i < ZOOM_IN_STEPS; i++) {
    await page.mouse.wheel(0, -100);
  }
  await page.keyboard.up('Control');
  await expect.poll(() => page.locator('video').count()).toBeGreaterThan(0);
  expect(await page.locator('video').count()).toBeLessThan(NODES / 10);

  const playing = await page.locator('video').first().evaluate(async (video: HTMLVideoElement) => {
    video.loop = true;
    await video.play();
    return video.closest('.svelte-flow__node')!.getAttribute('data-id');
  });
  await page.keyboard.down('Control');
  for (let i = 0; i < ZOOM_IN_STEPS; i++) {
    await page.mouse.wheel(0, 100);
  }
  await page.keyboard.up('Control');
  await expect(page.locator('.svelte-flow.poster-lod')).toHaveCount(1);
  await expect.poll(() => page.locator('video').count()).toBe(1);
  await expect(page.locator(`.svelte-flow__node[data-id="${playing}"] video`)).toHaveCount(1);
});

test('zoomed out, a pan takes the poster node shells out of layout and settles them back', async ({ page }) => {
  await mountZoomedOut(page);
  await expect(page.locator('.svelte-flow.poster-lod')).toHaveCount(1);
  await page.mouse.move(720, 450);

  for (let i = 0; i < PAN_STEPS; i++) {
    await page.mouse.wheel(40, 30);
  }

  expect(await shellDisplays(page)).toEqual(['none']);
  await expect.poll(() => shellDisplays(page)).toEqual(['block']);
});

type Crossing = { crossedAt: number; switchedAt: number; endedAt: number };

enum Zoom {
  In = -1,
  Out = 1
}

const WHEEL_STEPS = 60;
const WHEEL_DELTA = 30;
const WHEEL_EVERY_MS = 16;
const SWITCH_BUDGET_MS = 100;
const GIVE_UP_MS = 3000;

const zoomGesture = (page: Page, direction: Zoom) =>
  page.evaluate(
    ({ direction, steps, delta, every, threshold, lodClass }) =>
      new Promise<Crossing>((resolve) => {
        const flow = document.querySelector<HTMLElement>('.svelte-flow')!;
        const viewport = document.querySelector<HTMLElement>('.svelte-flow__viewport')!;
        const pane = document.querySelector<HTMLElement>('.svelte-flow__pane')!;
        const box = pane.getBoundingClientRect();
        const outward = direction > 0;
        const run = { crossedAt: 0, switchedAt: 0, endedAt: 0 };
        let sent = 0;

        const watch = () => {
          const zoom = new DOMMatrix(getComputedStyle(viewport).transform).a;
          const now = performance.now();
          if (!run.crossedAt && outward === zoom < threshold) {
            run.crossedAt = now;
          }
          if (run.crossedAt && !run.switchedAt && flow.classList.contains(lodClass) === outward) {
            run.switchedAt = now;
          }
          if (run.endedAt && (run.switchedAt || now - run.endedAt > GIVE_UP_MS)) {
            resolve(run);
            return;
          }
          requestAnimationFrame(watch);
        };
        requestAnimationFrame(watch);

        const tick = setInterval(() => {
          pane.dispatchEvent(new WheelEvent('wheel', { deltaY: direction * delta, ctrlKey: true, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2, bubbles: true, cancelable: true }));
          sent += 1;
          if (sent < steps) {
            return;
          }
          clearInterval(tick);
          run.endedAt = performance.now();
        }, every);
      }),
    { direction, steps: WHEEL_STEPS, delta: WHEEL_DELTA, every: WHEEL_EVERY_MS, threshold: LOD_ZOOM, lodClass: LOD_CLASS }
  );

const expectLiveSwitch = (run: Crossing) => {
  expect(run.crossedAt).toBeGreaterThan(0);
  expect(run.crossedAt).toBeLessThan(run.endedAt);
  expect(run.switchedAt).toBeGreaterThan(0);
  expect(run.switchedAt - run.crossedAt).toBeLessThan(SWITCH_BUDGET_MS);
  expect(run.switchedAt).toBeLessThan(run.endedAt);
};

test('zooming in, node details come back as the threshold is crossed, not after the gesture ends', async ({ page }) => {
  await mountZoomedOut(page);
  await expect(page.locator('.svelte-flow.poster-lod')).toHaveCount(1);

  expectLiveSwitch(await zoomGesture(page, Zoom.In));
});

test('zooming out, nodes turn into posters as the threshold is crossed, not after the gesture ends', async ({ page }) => {
  await mountZoomedOut(page);
  await zoomGesture(page, Zoom.In);
  await expect(page.locator('.svelte-flow.poster-lod')).toHaveCount(0);

  expectLiveSwitch(await zoomGesture(page, Zoom.Out));
});
