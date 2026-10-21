import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SHOTS = process.env.SHOT_PREFIX ?? '';
const PLAY_MS = 1500;
const CROP_HEIGHT = 560;
const TILE_AT = { x: 200, y: 80 };

const shape = (id: string, from: number, x: number, color: string) => ({ id, from, durationInFrames: 150 - from, component: 'Shape', props: { shape: 'rect', x, y: 0.5, width: 0.25, height: 0.4, fills: [{ type: 'solid', color }] } });

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [shape('first', 0, 0.3, '#ff5a1f'), shape('later', 90, 0.7, '#1f5aff')] }],
  comps: {},
  assets: []
};

test.describe('timeline under a canvas frame @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('selecting an element opens the timeline and playing redraws only the frame', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: TILE_AT.x, y: TILE_AT.y, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const surface = page.locator('[data-canvas-surface]');
    await expect(surface).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(4000);
    const view = (await surface.getAttribute('data-view'))!;
    await page.screenshot({ path: `${SHOTS}-0-before-${view}.png` });
    const click = { x: 392 + 0.3 * 420, y: 356 + 0.5 * 236 };

    await expect(async () => {
      await page.mouse.click(click.x, click.y);
      await expect(page.getByTestId('frame-timeline')).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 25_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}-1-selected.png` });
    const stillShot = await page.screenshot({ clip: { x: 0, y: 0, width: 1440, height: CROP_HEIGHT } });

    await page.getByTestId('frame-timeline-play').click();
    await page.waitForTimeout(PLAY_MS);
    await page.getByTestId('frame-timeline-play').click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}-2-played.png` });
    const playedShot = await page.screenshot({ clip: { x: 0, y: 0, width: 1440, height: CROP_HEIGHT } });

    expect(playedShot.equals(stillShot)).toBe(false);
    await expect(page.getByTestId('frame-timeline-time')).not.toHaveText('0.00s');
  });
});
