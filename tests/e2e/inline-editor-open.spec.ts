import { test, expect, type Page } from '@playwright/test';
import { REAL_STACK, signInE2e } from './fixtures/session';

const PROJECT = process.env.FLUID_PROJECT_ID ?? 'e472ff3c-4b1f-4b95-8f31-695e7940b40a';
const CANVAS = process.env.FLUID_CANVAS_ID ?? 'b5a892f3-3112-41b3-ab8c-5f7d0d69887d';
const LANDING_A = '546a6ab6-023a-443f-8add-aa7b667e8d08';
const LANDING_B = 'c64f817b-b1d3-4686-918a-5a8ff54513f9';
const WHEEL_ZOOM = 0.01;
const IDLE_MS = 6000;
const OPEN_MS = 15_000;

enum Phase {
  Visible = 'visible',
  Interactive = 'interactive'
}

type Timing = Record<Phase, number>;

async function zoomOnto(page: Page, id: string) {
  const goal = { x: 520, y: 440 };
  for (let i = 0; i < 3; i++) {
    const b = (await page.locator(`.svelte-flow__node[data-id="${id}"]`).boundingBox())!;
    await page.mouse.move(goal.x, goal.y);
    await page.mouse.wheel(b.x + b.width / 2 - goal.x, b.y + b.height / 2 - goal.y);
    await page.waitForTimeout(120);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -Math.log(Math.min(400 / b.width, 360 / b.height)) / WHEEL_ZOOM);
    await page.keyboard.up('Control');
    await page.waitForTimeout(200);
  }
}

async function openTimed(page: Page, id: string): Promise<Timing> {
  await zoomOnto(page, id);
  await page.waitForTimeout(1000);
  const box = (await page.locator(`.svelte-flow__node[data-id="${id}"]`).boundingBox())!;
  await page.evaluate(() => {
    const w = window as unknown as { __open: Promise<{ visible: number; interactive: number }> };
    w.__open = new Promise((done) => {
      addEventListener(
        'pointerdown',
        () => {
          const from = performance.now();
          let visible = 0;
          const tick = () => {
            const stage = document.querySelector('[data-testid="motion-editor"] [data-testid="editor-stage"]');
            if (!visible && stage && (stage as HTMLElement).offsetWidth) {
              visible = performance.now() - from;
            }
            const rows = document.querySelector('[data-testid="motion-editor"] .row.layer');
            if (visible && rows) {
              done({ visible, interactive: performance.now() - from });
              return;
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          setTimeout(() => done({ visible: visible || -1, interactive: -1 }), 15_000);
        },
        { capture: true, once: true }
      );
    });
  });
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: OPEN_MS });
  const t = await page.evaluate(() => (window as unknown as { __open: Promise<Timing> }).__open);
  return t;
}

async function close(page: Page) {
  for (let i = 0; i < 4 && (await page.getByTestId('motion-editor').count()); i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
  await expect(page.getByTestId('motion-editor')).toHaveCount(0, { timeout: OPEN_MS });
}

test.describe('inline editor open @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(180_000);

  test('cold, warm and reopen time to visible and interactive', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInE2e(page, { email: process.env.E2E_TEST_EMAIL!, password: process.env.E2E_TEST_PASSWORD! });
    await page.goto(`/p/${PROJECT}/c/${CANVAS}`, { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Reject all' }).click({ timeout: 4000 }).catch(() => undefined);
    await page.waitForTimeout(IDLE_MS);
    await page.locator('[data-canvas-surface], .svelte-flow').first().click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Shift+Digit1');
    await page.waitForTimeout(800);
    const frames = [LANDING_A, LANDING_B];

    const cold = await openTimed(page, frames[0]);
    await close(page);
    const warm = await openTimed(page, frames[1]);
    await close(page);
    const reopen = await openTimed(page, frames[0]);
    await close(page);
    console.log(`[open] ${JSON.stringify({ cold, warm, reopen })}`);
  });
});
