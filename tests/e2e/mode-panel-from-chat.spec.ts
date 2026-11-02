import { withSurface } from '@feega/motion-core/motion/surface';
import { landingDoc } from '@feega/motion-core/motion/codegen/fixtures/landing';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const DATA = { format: 'custom', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SIZE = { width: 1440, height: 4480 };
const VIEWPORT = { width: 1440, height: 900 };
const PANELS = [
  { mode: 'code', panel: 'dev-code' },
  { mode: 'play', panel: 'play-inspector' }
];

test.describe('a mode picked while the Chat tab is open @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');

  for (const { mode, panel } of PANELS) {
    test(`${mode} shows its panel instead of leaving the chat in front`, async ({ page, session, admin, seedNode }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(VIEWPORT);
      const node = await seedNode({ type: 'motion', x: 200, y: 200, data: DATA });
      await admin.from('nodes').update(SIZE).eq('id', node.id);
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: withSurface(landingDoc(), 'surface'), actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();

      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      const tile = page.locator(`[data-testid="gpu-node"][data-id="${node.id}"]`);
      await expect(tile).toBeVisible({ timeout: 30_000 });
      const box = (await tile.boundingBox())!;
      await expect(async () => {
        await page.mouse.click(box.x + box.width / 2, box.y + 40);
        await expect(page.getByTestId('side-tab-properties')).toBeVisible({ timeout: 1500 });
      }).toPass({ timeout: 30_000 });

      await page.getByTestId('side-tab-chat').filter({ visible: true }).click();
      await expect(page.getByTestId('side-tab-chat').filter({ visible: true })).toHaveAttribute('aria-selected', 'true');
      await page.locator(`[data-testid="editor-mode-switch"] [data-value="${mode}"]`).click();

      await expect(page.getByTestId(panel)).toBeVisible();
    });
  }
});
