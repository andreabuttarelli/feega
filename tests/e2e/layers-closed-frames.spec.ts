import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import motion from './fixtures/motion-doc.json' with { type: 'json' };
import poster from './fixtures/poster-type-grid.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const PORTRAIT = { ...LANDSCAPE, format: '4:5' };
const SHOTS = process.env.CANVAS_MOTION_SHOTS;
const TITLE_LINE = 'poster#lines:0';
const title = motion.tracks[0].clips[0];
const REUSED = {
  ...motion,
  comps: { scene: { name: 'Scene', durationInFrames: 90, tracks: [{ id: 'inner', kind: 'visual', name: 'Inner', clips: [{ ...title, id: 'deep' }] }] } },
  tracks: [{ ...motion.tracks[0], clips: [0, 1].map((n) => ({ ...title, id: `scene${n}`, from: n * 45, durationInFrames: 45, component: 'Precomp', props: { comp: 'scene' } })) }]
};

test.describe('layers of closed frames @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('with nothing selected, every frame lists its elements, never its timeline tracks', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(90_000);
    const frames = [
      { node: await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE }), doc: motion },
      { node: await seedNode({ type: 'motion', x: 900, y: 80, data: LANDSCAPE }), doc: motion },
      { node: await seedNode({ type: 'motion', x: 80, y: 900, data: PORTRAIT }), doc: poster },
      { node: await seedNode({ type: 'motion', x: 900, y: 900, data: LANDSCAPE }), doc: REUSED }
    ];
    for (const { node, doc } of frames) {
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
    }

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const layers = page.getByTestId('layers');

    await expect(layers.locator('[data-layer="poster"]'), 'every closed frame lists its elements').toHaveCount(1, { timeout: 15_000 });
    await expect(layers.locator('[data-kind="track"]'), 'tracks are not elements').toHaveCount(0);
    await expect(layers.locator('[data-layer="deep"]'), 'a scene played twice lists its insides under both').toHaveCount(2);
    await expect(layers.locator('[data-layer="t"]')).toHaveCount(2);
    await expect(layers.locator(`[data-layer="${TITLE_LINE}"]`), 'a closed poster lists its parts').toHaveCount(1);
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/layers-closed-frames.png` });
    }
  });

  test('a frame folds on demand and stays folded after a reload', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(90_000);
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: motion, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    const url = `/p/${session.projectId}/c/${session.canvasId}`;
    await gotoHydrated(page, url);
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const layers = page.getByTestId('layers');
    await expect(layers.locator('[data-layer="t"]')).toHaveCount(1, { timeout: 15_000 });

    await layers.getByTestId('layer-fold').click();
    await expect(layers.locator('[data-layer="t"]')).toHaveCount(0);

    await gotoHydrated(page, url);
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    await expect(layers.getByTestId('layer-fold')).toHaveAttribute('aria-expanded', 'false', { timeout: 15_000 });
    await expect(layers.locator('[data-layer="t"]')).toHaveCount(0);

    await layers.getByTestId('layer-fold').click();
    await expect(layers.locator('[data-layer="t"]')).toHaveCount(1);
  });
});
