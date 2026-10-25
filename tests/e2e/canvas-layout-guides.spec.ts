import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { SHOT_PREFIX } from './fixtures/shots';

const SETTLE_MS = 2500;
const GUIDES = [
  { kind: 'columns', count: 'auto', gutter: 20, margin: 0, size: 240, align: 'min', offset: 120, color: '#0066ff', opacity: 0.18 },
  { kind: 'rows', count: 3, gutter: 20, margin: 60, size: 8, align: 'stretch', offset: 0, color: '#ff0000', opacity: 0.1 }
];
const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  layoutGuides: GUIDES,
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [] }],
  comps: {},
  assets: []
};

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOT_PREFIX.replace(/shot$/, 'grid')}-${name}.png` });
}

test.describe('layout guides on the canvas @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  test('an auto count, an alignment and a colour draw, and the inspector edits them', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const frame = page.locator(`[data-frame="${node.id}"]`);
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, 'guides-drawn');

    const box = (await frame.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.getByRole('tab', { name: 'Properties' }).click();
    await expect(page.getByTestId('layout-guides-section')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('layout-guide')).toHaveCount(2);
    await shot(page, 'guides-inspector');

    const first = page.getByTestId('layout-guide').first();
    await first.getByLabel('Alignment').selectOption('center');
    await expect(first.getByLabel('Offset')).toHaveCount(0);
    await first.getByLabel('Count').fill('4');
    await first.getByLabel('Count').dispatchEvent('change');
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, 'guides-center');

    await page.getByRole('button', { name: 'Add layout grid' }).click();
    await expect(page.getByTestId('layout-guide')).toHaveCount(3);
    const added = page.getByTestId('layout-guide').nth(2);
    await added.getByLabel('Grid kind').selectOption('grid');
    await expect(added.getByLabel('Cell size')).toBeVisible();
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, 'guides-added-grid');
  });
});
