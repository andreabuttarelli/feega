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
