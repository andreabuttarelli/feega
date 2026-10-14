import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.E2E_SHOTS_DIR;
const POSTER = 'builtin:poster-checker-steps';
const SETTLE_MS = 2000;

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, open: (page: Page) => page.getByTestId('frame-templates').click() },
  { name: 'phone', width: 390, height: 844, open: (page: Page) => page.locator('[data-empty-action="frame"]').click() }
];

async function shoot(page: Page, name: string) {
  if (!SHOTS) {
    return;
  }
  await page.waitForTimeout(SETTLE_MS);
  await page.screenshot({ path: `${SHOTS}/after-${name}.png` });
}

test.describe('frame templates @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.describe.configure({ mode: 'serial' });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.name}: open from the canvas, Still, search, insert → a frame on the canvas`, async ({ page, session, admin }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);

      await viewport.open(page);
      const picker = page.getByRole('dialog', { name: 'Frame templates' });
      await expect(picker.getByRole('heading', { name: 'Frame templates' })).toBeVisible();
      expect(await picker.locator('video').count(), 'no wall of players: at most the hovered one').toBeLessThanOrEqual(1);
      await shoot(page, `${viewport.name}-picker`);

      await picker.getByRole('radio', { name: 'Still', exact: true }).click();
      await expect(picker.locator('[data-mode="video"]')).toHaveCount(0);
      await expect(picker.locator('section[data-shape="4:5"]')).toBeVisible();
      await shoot(page, `${viewport.name}-still`);

      await picker.getByTestId('component-search').fill('zzz-nothing');
      await expect(picker.getByTestId('frame-templates-empty')).toBeVisible();
      await picker.getByRole('button', { name: 'Clear filters' }).click();
      await expect(picker.locator('[data-mode="video"]').first()).toBeVisible();

      await picker.getByRole('radio', { name: 'Still', exact: true }).click();
      await picker.getByTestId('component-search').fill('checker');
      await expect(picker.locator('[data-component]')).toHaveCount(1);
      await shoot(page, `${viewport.name}-search`);

      await picker.locator(`[data-component="${POSTER}"]`).click();
      await expect(picker).toHaveCount(0);
      await expect(page.locator('[data-testid=motion-node]')).toHaveCount(1, { timeout: 15_000 });
      await expect
        .poll(async () => (await admin.from('nodes').select('id').eq('canvas_id', session.canvasId).eq('type', 'motion').is('deleted_at', null)).data?.length ?? 0, { message: 'the frame is saved' })
        .toBe(1);
      await shoot(page, `${viewport.name}-inserted`);
    });
  }

  test('desktop: one preview plays at a time, keyboard moves and Escape closes', async ({ page, session }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('frame-templates').click();
    const picker = page.getByRole('dialog', { name: 'Frame templates' });
    const search = picker.getByTestId('component-search');
    await expect(search).toBeFocused();

    const cards = picker.locator('[data-component][data-mode="video"]');
    await cards.nth(0).hover();
    await cards.nth(1).hover();
    await expect(picker.locator('video')).toHaveCount(1);
    await shoot(page, 'desktop-hover');

    await search.focus();
    await page.keyboard.press('ArrowDown');
    const first = picker.locator('[data-component]').first();
    await expect(first).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(picker.locator('[data-component]').nth(1)).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(picker).toHaveCount(0);
  });
});
