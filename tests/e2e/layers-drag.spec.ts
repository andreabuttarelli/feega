import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import motion from './fixtures/motion-doc.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SHOTS = process.env.CANVAS_MOTION_SHOTS;
const ROW_TOP = { x: 40, y: 3 };
const [visual, audio] = motion.tracks;
const title = visual.clips[0];
const STACKED = { ...motion, tracks: [{ ...visual, id: 'back-track', name: 'Video 1', clips: [{ ...title, id: 'back' }] }, { ...visual, id: 'front-track', name: 'Video 2', clips: [{ ...title, id: 'front' }] }, audio] };

test.describe('dragging rows in Layers @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('a row dragged above another moves its element up the stack, saved', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(90_000);
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: STACKED, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const layers = page.getByTestId('layers');
    await layers.locator(`[data-layer="${node.id}"]`).click();
    await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mount', 'canvas', { timeout: 15_000 });

    const rowIds = () => layers.locator('[data-kind="clip"]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-layer')));
    await expect.poll(rowIds).toEqual(['back', 'front']);

    await layers.locator('[data-layer="front"]').dragTo(layers.locator('[data-layer="back"]'), { targetPosition: ROW_TOP });

    await expect.poll(rowIds).toEqual(['front', 'back']);
    await expect
      .poll(async () => ((await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1)).data?.[0]?.doc as { tracks: { id: string }[] } | undefined)?.tracks.map((t) => t.id), { timeout: 10_000 })
      .toEqual(['front-track', 'back-track', audio.id]);
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/layers-drag.png` });
    }
  });
});
