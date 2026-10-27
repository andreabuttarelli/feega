import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS_DIR = `${process.env.HOME}/Documents/feega-videos/e2e`;
const FAR_AWAY = { x: 9000, y: 6000 };
const SETTLE_MS = 2000;

const selected = (page: Page) => page.locator('[data-testid="gpu-node"][aria-pressed="true"]');

test.describe('canvas search and selection link @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('Cmd+F jumps to a far node and ?nodes= opens with it selected', async ({ page, session, seedNode }) => {
    await seedNode({ type: 'text', x: 0, y: 0, data: { prompt: 'near headline' } });
    const far = await seedNode({ type: 'text', x: FAR_AWAY.x, y: FAR_AWAY.y, data: { prompt: 'zebra needle copy' } });
    const canvas = `/p/${session.projectId}/c/${session.canvasId}`;

    await gotoHydrated(page, canvas);
    await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);

    await page.keyboard.press('Control+f');
    await expect(page.getByTestId('node-search')).toBeVisible();
    await page.getByTestId('node-search-input').fill('zebra');
    await page.screenshot({ path: `${SHOTS_DIR}/f4-search-open.png` });
    await page.keyboard.press('Enter');
    await expect(selected(page)).toHaveCount(1);
    await expect(page.locator(`[data-testid="gpu-node"][data-id="${far.id}"]`)).toBeVisible();
    await page.screenshot({ path: `${SHOTS_DIR}/f4-search-jumped.png` });

    await gotoHydrated(page, `${canvas}?nodes=${far.id}`);
    await expect(selected(page)).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator(`[data-testid="gpu-node"][data-id="${far.id}"]`)).toBeVisible();
    await expect(page).not.toHaveURL(/nodes=/);
    await page.screenshot({ path: `${SHOTS_DIR}/f4-selection-link.png` });
  });
});
