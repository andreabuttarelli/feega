import { test, expect, devices, webkit, type Page } from '@playwright/test';
import heavy from './fixtures/heavy-canvas-landings.json' with { type: 'json' };

const MOTION_FRAME = '61c7743a-add3-4f9a-96db-7c6eb3ed54bf';
const MIN_FPS_P50 = 45;
const PLAY_MS = 4_000;
const SETTLE_MS = 12_000;
const OPEN_MS = 20_000;
const ZOOM_STEPS = 12;
const MIN_TAP_PX = 140;
const PAN_STEPS = 6;
const CENTRED_PX = 20;
const EDGE_PX = 60;

async function login(page: Page, base: string) {
  await page.goto(`${base}/login`);
  await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
  await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
  await page.press('input[type=password]', 'Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'commit' });
}

const wheel = (page: Page, at: { x: number; y: number }, delta: { deltaX?: number; deltaY: number; ctrlKey?: boolean }) =>
  page.evaluate(([at, delta]) => document.elementFromPoint(at.x, at.y)?.dispatchEvent(new WheelEvent('wheel', { clientX: at.x, clientY: at.y, bubbles: true, cancelable: true, ...delta })), [at, delta] as const);

async function openFrame(page: Page, nodeId: string) {
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
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(800);
  await page.mouse.dblclick(at.x, at.y);
  await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: OPEN_MS });
}

test.describe('a motion frame plays smoothly on an iPad @real', () => {
  test.skip(!process.env.E2E_HEAVY_PHONE || !process.env.E2E_TEST_EMAIL, 'needs E2E_HEAVY_PHONE=1 and the test account on the heavy canvas copy');
  test.setTimeout(120_000);

  test('playback keeps its layers and runs at 45 fps or more inside the preview', async ({ baseURL }) => {
    const browser = await webkit.launch();
    const page = await (await browser.newContext({ ...devices['iPad Pro 11'], serviceWorkers: 'block' })).newPage();
    await login(page, baseURL!);
    await page.goto(`${baseURL}/p/${heavy.projectId}/c/${heavy.canvasId}`);
    await page.getByRole('button', { name: 'Reject all' }).click({ timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS);
    await openFrame(page, MOTION_FRAME);
    await page.waitForTimeout(3_000);

    const preview = page.frames().find((f) => f.url().startsWith('about:srcdoc'))!;
    const layers = await preview.evaluate(() => [...document.querySelectorAll('*')].filter((el) => getComputedStyle(el).willChange !== 'auto').length);
    await preview.evaluate(() => {
      const w = window as unknown as { gaps: number[] };
      w.gaps = [];
      let last = 0;
      const tick = (t: number) => {
        if (last) {
          w.gaps.push(t - last);
        }
        last = t;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.getByTestId('motion-editor').getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForTimeout(PLAY_MS);
    const gaps = await preview.evaluate(() => (window as unknown as { gaps: number[] }).gaps.sort((a, b) => a - b));
    await browser.close();

    const p50 = Math.round(1000 / gaps[Math.floor(gaps.length / 2)]);
    console.log(`iPad playback: ${p50} fps p50, ${layers} hinted layers`);
    expect(layers, 'the preview keeps its will-change layers while it plays').toBeGreaterThan(0);
    expect(p50).toBeGreaterThanOrEqual(MIN_FPS_P50);
  });
});
