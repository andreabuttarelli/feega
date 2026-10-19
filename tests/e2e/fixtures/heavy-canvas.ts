import { expect, type Page } from '@playwright/test';

const OPEN_MS = 20_000;
const ZOOM_STEPS = 12;
const MIN_TAP_PX = 140;
const PAN_STEPS = 6;
const CENTRED_PX = 20;
const EDGE_PX = 60;

export async function login(page: Page, base: string) {
  await page.goto(`${base}/login`);
  await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
  await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
  await page.press('input[type=password]', 'Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'commit' });
}

const wheel = (page: Page, at: { x: number; y: number }, delta: { deltaX?: number; deltaY: number; ctrlKey?: boolean }) =>
  page.evaluate(([at, delta]) => document.elementFromPoint(at.x, at.y)?.dispatchEvent(new WheelEvent('wheel', { clientX: at.x, clientY: at.y, bubbles: true, cancelable: true, ...delta })), [at, delta] as const);

export async function openFrame(page: Page, nodeId: string) {
  const node = page.locator(`.svelte-flow__node[data-id="${nodeId}"]`);
  const view = page.viewportSize()!;
  const centre = { x: view.width / 2, y: view.height / 2 };
  let box = (await node.boundingBox())!;
  for (let i = 0; i < PAN_STEPS; i++) {
    const dx = box.x + box.width / 2 - centre.x;
    const dy = box.y + Math.min(box.height, centre.y) / 2 - centre.y;
    if (Math.abs(dx) < CENTRED_PX && Math.abs(dy) < CENTRED_PX) {
      break;
    }
    await wheel(page, centre, { deltaX: dx, deltaY: dy });
    await page.waitForTimeout(600);
    box = (await node.boundingBox())!;
  }
  const at = { x: (Math.max(box.x, EDGE_PX) + box.x + box.width) / 2, y: box.y + Math.min(box.height, centre.y) / 2 };
  for (let i = 0; i < ZOOM_STEPS && box.width < MIN_TAP_PX; i++) {
    await wheel(page, at, { deltaY: -60, ctrlKey: true });
    await page.waitForTimeout(250);
    box = (await node.boundingBox())!;
  }
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(800);
  await page.mouse.dblclick(at.x, at.y);
  await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: OPEN_MS });
}
