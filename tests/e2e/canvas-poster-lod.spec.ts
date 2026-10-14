import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { test, expect, type Page } from '@playwright/test';

const HARNESS = '/tests/e2e/fixtures/motion-canvas-harness.ts';
const NODES = 300;
const COLUMNS = 18;
const STEP = { x: 520, y: 640 };
const RED = { r: 204, g: 51, b: 51 };
const PAN_STEPS = 6;

const redImage = async () => `data:image/jpeg;base64,${(await sharp({ create: { width: 400, height: 400, channels: 3, background: RED } }).jpeg().toBuffer()).toString('base64')}`;

function redVideo(): string {
  const webm = execFileSync('ffmpeg', ['-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0xcc3333:s=320x320:d=1', '-c:v', 'libvpx-vp9', '-f', 'webm', 'pipe:1']);
  return `data:video/webm;base64,${webm.toString('base64')}`;
}

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
