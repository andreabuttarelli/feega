import { openInsert } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import path from 'node:path';
import { SHOTS_DIR } from './fixtures/shots';

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const FRAME_AT = { x: 200, y: 80 };
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_MS = 4000;
const BLUE_SQUARE = path.join(import.meta.dirname, 'fixtures', 'blue-square.png');
const FRAME_CLICK = { x: 392 + 0.3 * 420, y: 356 + 0.5 * 236 };

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [] }],
  comps: {},
  assets: []
};

test.describe('the add bar with a frame selected @real', () => {
  test.skip(!REAL_STACK, 'requires E2E_REAL_STACK=1');

  test('adds Insert image and Frame templates, keeps Generate; image lands in the frame; templates open', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'motion', x: FRAME_AT.x, y: FRAME_AT.y, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await page.setViewportSize(VIEWPORT);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const bar = page.getByTestId('add-bar');
    await expect(bar).toHaveAttribute('data-context', 'canvas');
    await expect((await openInsert(page)).locator('[data-insert="image"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS_DIR}/addbar-1-nothing-selected.png` });

    await expect(async () => {
      await page.mouse.click(FRAME_CLICK.x, FRAME_CLICK.y);
      await expect(bar).toHaveAttribute('data-context', 'frame', { timeout: 1500 });
    }).toPass({ timeout: 25_000 });

    const menu = await openInsert(page);
    await expect(menu.locator('[data-insert="image"]')).toBeVisible();
    await expect(menu.locator('[data-insert="frame-library"]')).toBeVisible();
    await expect(menu.locator('button[draggable="true"]').first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS_DIR}/addbar-2-frame-selected.png` });

    await bar.getByTestId('frame-image-input').setInputFiles(BLUE_SQUARE);
    await expect
      .poll(
        async () => {
          const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1);
          const latest = data?.[0]?.doc as { tracks: { clips: { component: string }[] }[] } | undefined;
          return latest?.tracks.flatMap((t) => t.clips).some((c) => c.component === 'Image');
        },
        { timeout: 30_000 }
      )
      .toBe(true);
    await page.screenshot({ path: `${SHOTS_DIR}/addbar-3-image-in-frame.png` });

    await (await openInsert(page)).locator('[data-insert="frame-library"]').click();
    await expect(page.getByTestId('template-library')).toBeVisible();
    await page.screenshot({ path: `${SHOTS_DIR}/addbar-4-templates.png` });
  });
});
