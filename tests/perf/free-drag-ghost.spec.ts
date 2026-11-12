import { test, expect, type Page } from '@playwright/test';
import { FREE_DRAG_OVER, FREE_DRAG_PLACE, FREE_DRAG_UNDER } from '../../scripts/perf/free-drag-fixture.mjs';

type Box = { x: number; y: number; w: number; h: number };
type Rgb = [number, number, number];

const SHOTS = process.env.FREE_DRAG_SHOTS;
const VIEWPORT = { width: 1440, height: 900 };
const OPEN_MS = 120_000;
const DRAG_STEPS = 30;
const HOLD_MS = 400;
const FRAME_MS = 50;
const GREY: Rgb = [128, 128, 128];
const RED: Rgb = [255, 0, 0];
const NEAR = 40;
const FIT_MS = 1500;

async function boxOf(page: Page, id: string): Promise<Box> {
  const r = (await page.locator(`[data-testid="gpu-node"][data-id="${id}"]`).boundingBox())!;
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}

const centreOf = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

async function open(page: Page) {
  await page.goto(`/p/${FREE_DRAG_PLACE.projectId}/c/${FREE_DRAG_PLACE.canvasId}`);
  await expect(page.locator(`[data-testid="gpu-node"][data-id="${FREE_DRAG_UNDER.id}"]`)).toBeAttached({ timeout: OPEN_MS });
  await page.keyboard.press('Shift+Digit1');
  await page.waitForTimeout(FIT_MS);
}

async function pixel(page: Page, at: { x: number; y: number }, name: string): Promise<Rgb> {
  const shot = await page.screenshot(SHOTS ? { path: `${SHOTS}/${name}.png` } : {});
  return page.evaluate(
    async ([b64, x, y]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = new OffscreenCanvas(img.width, img.height);
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0);
      const scale = img.width / innerWidth;
      const d = g.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
      return [d[0], d[1], d[2]] as Rgb;
    },
    [shot.toString('base64'), at.x, at.y] as const
  );
}

const near = (a: Rgb, b: Rgb) => a.every((v, i) => Math.abs(v - b[i]) <= NEAR);

test.use({ viewport: VIEWPORT, headless: false, launchOptions: { args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] } });

test('dragging a free element moves only it: the one above stays put and on top', async ({ page }) => {
  test.setTimeout(OPEN_MS * 2);
  await open(page);

  const under = await boxOf(page, FREE_DRAG_UNDER.id);
  const overBox = await boxOf(page, FREE_DRAG_OVER.id);
  const over = { x: overBox.x + overBox.w * 0.3, y: overBox.y + overBox.h * 0.5 };
  await expect.poll(async () => near(await pixel(page, over, '0-start'), GREY), { timeout: OPEN_MS }).toBe(true);

  const grab = { x: under.x + under.w * 0.8, y: under.y + under.h * 0.8 };
  const shift = { x: under.w * 0.3, y: under.h * 0.2 };
  const carried = { x: over.x + shift.x, y: over.y + shift.y };
  const redNow = { x: under.x + under.w * 0.55 + shift.x, y: under.y + under.h * 0.3 + shift.y };
  const vacated = { x: under.x + under.w * 0.1, y: under.y + under.h * 0.1 };

  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(grab.x + shift.x, grab.y + shift.y, { steps: DRAG_STEPS });
  await page.waitForTimeout(FRAME_MS);

  const check = async (stage: string) => {
    expect(near(await pixel(page, over, `${stage}-over`), GREY), `${stage}: the element above stays where it is`).toBe(true);
    expect(near(await pixel(page, carried, `${stage}-carried`), RED), `${stage}: the dragged one does not carry the element above`).toBe(true);
    expect(near(await pixel(page, redNow, `${stage}-moved`), RED), `${stage}: the dragged one is drawn where it moved`).toBe(true);
    expect(near(await pixel(page, vacated, `${stage}-vacated`), RED), `${stage}: nothing left where it was`).toBe(false);
  };

  await check('1-mid-drag');
  await page.mouse.up();
  await page.waitForTimeout(HOLD_MS);
  await check('2-dropped');
});

test('a free element dragged off the one below takes only itself and leaves the one below whole', async ({ page }) => {
  test.setTimeout(OPEN_MS * 2);
  await open(page);

  const under = await boxOf(page, FREE_DRAG_UNDER.id);
  const overBox = await boxOf(page, FREE_DRAG_OVER.id);
  const grab = centreOf(overBox);
  await expect.poll(async () => near(await pixel(page, grab, 'top-0-start'), GREY), { timeout: OPEN_MS }).toBe(true);
  const to = { x: under.x + under.w * 0.15, y: under.y + under.h * 0.15 };

  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: DRAG_STEPS });
  await page.waitForTimeout(FRAME_MS);

  const check = async (stage: string) => {
    expect(near(await pixel(page, { x: to.x - overBox.w * 0.2, y: to.y }, `top-${stage}-moved`), GREY), `${stage}: the dragged one is drawn under the pointer`).toBe(true);
    expect(near(await pixel(page, { x: grab.x + overBox.w * 0.2, y: grab.y }, `top-${stage}-left`), RED), `${stage}: the one below shows where it was`).toBe(true);
  };

  await check('1-mid-drag');
  await page.mouse.up();
  await page.waitForTimeout(HOLD_MS);
  await check('2-dropped');
});
