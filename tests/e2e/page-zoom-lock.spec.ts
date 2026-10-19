import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import type {} from './fixtures/zoom-lock-harness';

const HOST_PAGE = '/changelog';
const HARNESS = '/tests/e2e/fixtures/zoom-lock-harness.ts';
const PANEL = '[data-testid="panel"]';
const PANE = '.svelte-flow__pane';
const PINCH_IN = -100;

async function open(page: Page) {
  await page.goto(HOST_PAGE);
  await page.evaluate((path) => import(path), HARNESS);
  await page.evaluate(() => window.zoomLock.mount());
  await expect(page.locator('.svelte-flow__viewport')).toBeVisible();
}

function canvasZoom(page: Page): Promise<number> {
  return page.locator('.svelte-flow__viewport').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
}

function pageScale(page: Page) {
  return page.evaluate(() => ({ scale: window.visualViewport?.scale ?? 1, ratio: window.devicePixelRatio }));
}

function pinchOver(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).first().evaluate((el, deltaY) => {
    const box = el.getBoundingClientRect();
    const wheel = new WheelEvent('wheel', { deltaY, ctrlKey: true, bubbles: true, cancelable: true, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 });
    return !el.dispatchEvent(wheel);
  }, PINCH_IN);
}

for (const [where, selector] of [
  ['a panel', PANEL],
  ['the canvas', PANE]
]) {
  test(`pinch over ${where} zooms the canvas, never the page`, async ({ page }) => {
    await open(page);
    const before = await pageScale(page);
    const zoom = await canvasZoom(page);

    expect(await pinchOver(page, selector)).toBe(true);

    await expect.poll(() => canvasZoom(page)).toBeGreaterThan(zoom);
    expect(await pageScale(page)).toEqual(before);
  });
}

test('mod+= zooms the canvas and the browser does not zoom the page', async ({ page }) => {
  await open(page);
  const before = await pageScale(page);
  const zoom = await canvasZoom(page);
  await page.evaluate(() => window.addEventListener('keydown', (e) => (window.zoomKeyBlocked = e.defaultPrevented)));

  await page.locator(PANEL).click();
  await page.keyboard.press('ControlOrMeta+Equal');

  await expect.poll(() => canvasZoom(page)).toBeGreaterThan(zoom);
  expect(await page.evaluate(() => window.zoomKeyBlocked)).toBe(true);
  expect(await pageScale(page)).toEqual(before);
});

const BAR = '[data-testid="bar"]';
const SPREAD = 1.5;
const MIN_TOUCH_FONT_PX = 16;

function pinchTouches(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).first().evaluate((el) => {
    const twoFingers = (type: string) => {
      const e = new TouchEvent(type, { bubbles: true, cancelable: true });
      Object.defineProperty(e, 'touches', { value: { length: 2 } });
      return e;
    };
    el.dispatchEvent(twoFingers('touchstart'));
    return !el.dispatchEvent(twoFingers('touchmove'));
  });
}

function gesture(page: Page, selector: string, scale: number): Promise<boolean[]> {
  return page.locator(selector).first().evaluate((el, scale) => {
    const fire = (type: string, value: number) => {
      const e = Object.assign(new UIEvent(type, { bubbles: true, cancelable: true }), { scale: value });
      Object.defineProperty(e, 'scale', { value });
      return !el.dispatchEvent(e);
    };
    return [fire('gesturestart', 1), fire('gesturechange', scale), fire('gestureend', scale)];
  }, scale);
}

test.describe('touch tablets: pinch never zooms the page', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'touch only');

  test('a two-finger pinch over a scrolling bar is held, the page stays at scale 1', async ({ page }) => {
    await open(page);

    expect(await pinchTouches(page, BAR), 'the browser never gets the pinch').toBe(true);
    expect(await page.locator(BAR).evaluate((el) => getComputedStyle(el).touchAction)).toBe('pan-x pan-y');
    expect((await pageScale(page)).scale).toBe(1);
  });

  test('a Safari pinch gesture over a bar zooms the canvas, not the page', async ({ page }) => {
    await open(page);
    const zoom = await canvasZoom(page);

    expect(await gesture(page, BAR, SPREAD)).toEqual([true, true, true]);

    await expect.poll(() => canvasZoom(page)).toBeGreaterThan(zoom);
    expect((await pageScale(page)).scale).toBe(1);
  });

  test('a Safari pinch gesture over the canvas is left to the canvas own pinch, never doubled', async ({ page }) => {
    await open(page);
    const zoom = await canvasZoom(page);

    expect(await gesture(page, PANE, SPREAD)).toEqual([true, true, true]);

    expect(await canvasZoom(page)).toBe(zoom);
  });

  test('a text field is at least 16px, so focusing it never auto-zooms', async ({ page }) => {
    await open(page);

    const size = await page.getByTestId('bar-input').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    expect(size).toBeGreaterThanOrEqual(MIN_TOUCH_FONT_PX);
  });
});
