import { randomUUID } from 'node:crypto';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS_DIR = `${process.env.HOME}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2000;

test.describe('compare two outputs @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('two image nodes open a slider that moves', async ({ page, session, admin, seedNode }) => {
    const refs: string[] = [];
    for (const _ of [0, 1]) {
      const id = randomUUID();
      const { error } = await admin.from('assets').insert({ id, org_id: session.orgId, project_id: session.projectId, type: 'image', source: 'generated' });
      expect(error).toBeNull();
      refs.push(id);
    }
    const a = await seedNode({ type: 'image', x: 0, y: 0, data: { prompt: 'shoe a', refId: refs[0] } });
    const b = await seedNode({ type: 'image', x: 700, y: 0, data: { prompt: 'shoe b', refId: refs[1] } });

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);

    const boxA = (await page.locator(`[data-testid="gpu-node"][data-id="${a.id}"]`).boundingBox())!;
    await page.mouse.click(boxA.x + boxA.width / 2, boxA.y + boxA.height - 20);
    const boxB = (await page.locator(`[data-testid="gpu-node"][data-id="${b.id}"]`).boundingBox())!;
    await page.keyboard.down('Shift');
    await page.mouse.click(boxB.x + boxB.width / 2, boxB.y + boxB.height - 20);
    await page.keyboard.up('Shift');

    await page.getByTestId('compare-outputs').click();
    await expect(page.getByTestId('compare-overlay')).toBeVisible();
    const handle = page.getByTestId('compare-handle');
    await expect(handle).toHaveAttribute('aria-valuenow', '50');
    await handle.focus();
    await page.keyboard.press('ArrowRight');
    await expect(handle).toHaveAttribute('aria-valuenow', '55');
    await page.screenshot({ path: `${SHOTS_DIR}/f4-compare.png` });

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('compare-overlay')).toHaveCount(0);
  });
});
