import { randomUUID } from 'node:crypto';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { SHOTS_DIR } from './fixtures/anim-doc';

const IMAGE_AT = { x: 240, y: 160 };
const IMAGE_SIZE = { width: 360, height: 270 };
const CLICK_ON_IMAGE = { x: IMAGE_AT.x + 220, y: IMAGE_AT.y + 200 };
const TITLE_BOX = { label: 'title', box: { left: 0.1, top: 0.05, width: 0.8, height: 0.15 } };

test.describe('split layers @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('a split image offers Layers to frame, and a click lands a frame of image elements', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });

    const [baseId, titleId] = [randomUUID(), randomUUID()];
    const { error } = await admin.from('assets').insert(
      [baseId, titleId].map((id) => ({ id, org_id: session.orgId, project_id: session.projectId, type: 'image', source: 'generated', url: `${session.userId}/e2e/${id}.png`, mime_type: 'image/png', width: 800, height: 600 }))
    );
    expect(error).toBeNull();
    const source = await seedNode({ type: 'image', x: IMAGE_AT.x, y: IMAGE_AT.y, data: { prompt: '', refId: baseId, layerRefIds: [titleId], layerBoxes: [TITLE_BOX], ...IMAGE_SIZE } });

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(3000);

    const toFrame = page.getByRole('button', { name: 'Layers to frame' });
    await expect(async () => {
      await page.mouse.click(CLICK_ON_IMAGE.x, CLICK_ON_IMAGE.y);
      await expect(toFrame).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 25_000 });
    await expect(page.getByRole('button', { name: 'Split into layers' })).toBeVisible();
    await page.screenshot({ path: `${SHOTS_DIR}/f1-layers-toolbar.png` });

    await toFrame.click();

    await expect(async () => {
      const { data } = await admin.from('nodes').select('id, type').eq('canvas_id', session.canvasId).neq('id', source.id).is('deleted_at', null);
      expect(data?.length ?? 0).toBeGreaterThan(0);
    }).toPass({ timeout: 20_000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SHOTS_DIR}/f1-layers-frame.png` });
  });
});
