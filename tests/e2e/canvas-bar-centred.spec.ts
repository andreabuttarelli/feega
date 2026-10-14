import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Locator, Page } from '@playwright/test';
import motion from './fixtures/motion-doc.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const TOLERANCE_PX = 2;

async function centreX(target: Locator): Promise<number> {
  const box = (await target.boundingBox())!;
  return box.x + box.width / 2;
}

async function visibleStageCentre(page: Page): Promise<number> {
  const stage = (await page.locator('.canvas-stage').boundingBox())!;
  const side = page.getByTestId('side-column');
  const sideBox = (await side.count()) && (await side.isVisible()) ? await side.boundingBox() : null;
  const right = sideBox && sideBox.x > stage.x ? Math.min(stage.x + stage.width, sideBox.x) : stage.x + stage.width;
  return (stage.x + right) / 2;
}

test.describe('the bottom bar is centred on the canvas you can see @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack reale: E2E_REAL_STACK=1');

  test('while browsing and while a frame is open beside its side column', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: motion, actor_kind: 'user', actor_id: session.userId });

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const bar = page.getByTestId('add-bar');
    await expect(bar).toHaveAttribute('data-context', 'canvas');
    expect(Math.abs((await centreX(bar)) - (await visibleStageCentre(page)))).toBeLessThanOrEqual(TOLERANCE_PX);

    await page.getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    await expect(bar).toHaveAttribute('data-context', 'frame', { timeout: 15_000 });
    await expect
      .poll(async () => Math.abs((await centreX(bar)) - (await visibleStageCentre(page))), { timeout: 5_000 })
      .toBeLessThanOrEqual(TOLERANCE_PX);
  });
});
