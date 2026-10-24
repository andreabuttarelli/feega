import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = `${process.env.HOME}/Documents/feega-videos/e2e`;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const PLAY_MS = 800;
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

test.describe('comments on the frame timeline @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('pin at the playhead, see the marker, click it to seek', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: TILE_AT.x, y: TILE_AT.y, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(4000);

    await expect(async () => {
      await page.mouse.click(392 + 0.3 * 420, 356 + 0.5 * 236);
      await expect(page.getByTestId('frame-timeline')).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 25_000 });

    await page.getByTestId('frame-timeline-play').click();
    await page.waitForTimeout(PLAY_MS);
    await page.getByTestId('frame-timeline-play').click();
    const pinnedAt = (await page.getByTestId('frame-timeline-time').textContent())!;
    expect(pinnedAt).not.toBe('0.00s');

    await page.getByTestId('frame-timeline-pin').click();
    await page.getByTestId('comment-draft').fill('Timing is late here');
    await page.getByTestId('comment-add').click();

    await expect(page.getByTestId('frame-timeline-mark')).toHaveCount(1);
    await expect(page.getByTestId('comment-time')).toHaveText(pinnedAt);
    await expect.poll(async () => (await admin.from('canvas_comments').select('time_ms').eq('canvas_id', session.canvasId)).data?.[0]?.time_ms).toBeGreaterThan(0);
    await page.screenshot({ path: `${SHOTS}/comments3-timeline-marker.png` });

    await page.getByTestId('frame-timeline-play').click();
    await page.waitForTimeout(PLAY_MS);
    await page.getByTestId('frame-timeline-play').click();
    await expect(page.getByTestId('frame-timeline-time')).not.toHaveText(pinnedAt);

    await page.getByTestId('frame-timeline-mark').click();
    await expect(page.getByTestId('frame-timeline-time')).toHaveText(pinnedAt);
    await page.screenshot({ path: `${SHOTS}/comments3-timeline-seek.png` });
  });
});
