import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const PORTRAIT = { format: '4:5', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };

const DOC = {
  version: 5,
  fps: 30,
  width: 1080,
  height: 1350,
  durationInFrames: 300,
  tracks: [
    {
      id: 'v1',
      kind: 'visual',
      name: 'Video 1',
      clips: [{ id: 'box', from: 0, durationInFrames: 300, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.4, height: 0.4, fills: [{ type: 'solid', color: '#ff5a1f' }] } }]
    }
  ],
  comps: {},
  assets: []
};

async function stageAt(page: Page, fx: number, fy: number) {
  const box = (await page.getByTestId('motion-preview').boundingBox())!;
  return { x: box.x + box.width * fx, y: box.y + box.height * fy };
}

test.describe('the first press on the editor preview @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test.beforeEach(async ({ page, session, admin, seedNode }) => {
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: PORTRAIT });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: DOC, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    await expect(page.getByTestId('selection-overlay')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('motion-preview').locator('hyperframes-player')).toBeAttached();
    await page.waitForTimeout(1500);
  });

  test('selects the box under it', async ({ page }) => {
    const at = await stageAt(page, 0.5, 0.5);
    await page.mouse.click(at.x, at.y);

    await expect(page.getByTestId('selection-box')).toBeVisible();
  });

  test('drags the box it lands on', async ({ page }) => {
    const from = await stageAt(page, 0.5, 0.5);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 60, from.y + 40, { steps: 6 });
    await page.mouse.up();

    const ring = (await page.getByTestId('selection-box').boundingBox())!;
    expect(ring.x + ring.width / 2).toBeGreaterThan(from.x + 40);
  });

  test('a press while playing pauses on the clip under it', async ({ page }) => {
    await page.getByRole('group', { name: 'Transport' }).getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByTestId('selection-overlay')).toHaveCount(0);

    const at = await stageAt(page, 0.5, 0.5);
    await page.mouse.click(at.x, at.y);

    await expect(page.getByTestId('selection-overlay')).toBeVisible();
    await expect(page.getByTestId('selection-box')).toBeVisible();
  });
});
