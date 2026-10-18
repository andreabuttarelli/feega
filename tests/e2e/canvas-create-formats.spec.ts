import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };

const frameDoc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'a', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.3, y: 0.5, width: 0.2, height: 0.2 } }] }],
  comps: {},
  assets: []
};

test.describe('create formats @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('the frame menu makes editable copies of a frame in other formats', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: frameDoc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator(`.svelte-flow__node[data-id="${frame.id}"]`).click({ button: 'right', position: { x: 4, y: 4 } });
    await page.getByRole('menuitem', { name: /Create formats/ }).click();
    await page.getByTestId('format-16:9').uncheck();
    await page.getByTestId('formats-create').click();

    const frames = async () => (await admin.from('nodes').select('id, data').eq('canvas_id', session.canvasId).eq('type', 'motion').is('deleted_at', null)).data ?? [];
    await expect.poll(async () => (await frames()).length, { timeout: 15_000 }).toBe(4);
    const formats = (await frames()).filter((n) => n.id !== frame.id).map((n) => (n.data as { format: string }).format).sort();
    expect(formats).toEqual(['1:1', '4:5', '9:16']);
  });
});
