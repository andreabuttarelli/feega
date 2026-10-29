import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.CANVAS_MOTION_SHOTS;
const STAGE = process.env.SHOT_NAME ?? 'after';
const PHONE = { width: 390, height: 844 };

enum BarPick {
  Design = 'Design',
  Generate = 'Generate'
}

test.use({ video: process.env.E2E_VIDEO ? 'on' : 'off' });

test.describe('the canvas bar has two short sets @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.describe.configure({ timeout: 120_000 });

  test('a tiny switch flips Design and Generate; select stays; shortcuts work in both; the choice is remembered', async ({ page, session }) => {
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const bar = page.getByTestId('add-bar');
    if (SHOTS) {
      await bar.screenshot({ path: `${SHOTS}/${STAGE}-desktop.png` });
    }
    if (STAGE === 'before') {
      return;
    }
    const mode = bar.getByTestId('bar-mode');

    await mode.getByRole('radio', { name: 'Design' }).click();
    await expect(bar.getByTestId('draw-tools')).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Generate text', exact: true })).toHaveCount(0);
    if (SHOTS) {
      await bar.screenshot({ path: `${SHOTS}/after-design.png` });
    }

    await mode.getByRole('radio', { name: 'Generate' }).click();
    for (const name of ['Generate text', 'Generate image', 'Generate video', 'Generate audio', 'Generate 3D model']) {
      await expect(bar.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(bar.locator('[data-tool="select"]'), 'select stays in Generate').toBeVisible();
    await expect(bar.locator('[data-tool="rectangle"]')).toHaveCount(0);
    if (SHOTS) {
      await bar.screenshot({ path: `${SHOTS}/after-generate.png` });
    }

    await page.locator('.svelte-flow__pane').click({ position: { x: 10, y: 10 } });
    await page.keyboard.press('Shift+R');
    await expect(page.getByTestId('canvas-draw'), 'a draw shortcut works while Generate shows').toBeVisible();
    await page.keyboard.press('Escape');

    await page.reload();
    await expect(page.getByTestId('add-bar').getByTestId('bar-mode').getByRole('radio', { name: 'Generate' })).toHaveAttribute('aria-checked', 'true');

    for (const pick of [BarPick.Design, BarPick.Generate]) {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.getByTestId('add-bar').getByTestId('bar-mode').getByRole('radio', { name: pick }).click();
      await page.setViewportSize(PHONE);
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      const canvasView = page.getByTestId('mobile-view-canvas');
      if (await canvasView.isVisible()) {
        await canvasView.click();
      }
      const phoneBar = page.getByTestId('add-bar');
      await expect(phoneBar).toBeVisible();
      if (SHOTS) {
        await page.screenshot({ path: `${SHOTS}/after-phone-${pick.toLowerCase()}.png` });
      }
      const box = (await phoneBar.boundingBox())!;
      expect(box.x, `the ${pick} bar fits a phone`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(PHONE.width);
      await page.setViewportSize({ width: 1280, height: 720 });
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    }
  });
});
