import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const PORTRAIT = { format: '4:5', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SHOTS = process.env.CANVAS_MOTION_SHOTS;

function paintDoc() {
  const star = {
    id: 'star',
    from: 0,
    durationInFrames: 150,
    component: 'Shape',
    props: {
      shape: 'star',
      points: 5,
      innerRadius: 0.3,
      x: 0.3,
      y: 0.3,
      width: 0.4,
      height: 0.4,
      fills: [{ type: 'solid', color: '#ffd400' }],
      strokes: [{ paint: { type: 'solid', color: '#2b2bff' }, width: 0.03, join: 'miter', miter: 20 }]
    }
  };
  const card = {
    id: 'card',
    from: 0,
    durationInFrames: 150,
    component: 'Shape',
    effects: [{ id: 'sh', kind: 'drop-shadow', enabled: true, params: { distance: 0, x: 30, y: 40, blur: 20, spread: 24, opacity: 0.75, behind: 0 } }],
    props: { shape: 'rect', x: 0.6, y: 0.7, width: 0.5, height: 0.3, fills: [{ type: 'solid', color: '#ff5a1f', opacity: 0.4 }] }
  };
  const paper = { id: 'paper', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, fills: [{ type: 'solid', color: '#f4f1ea' }] } };
  return { version: 5, fps: 30, width: 1080, height: 1350, durationInFrames: 150, still: { frame: 90 }, tracks: [{ id: 'v2', kind: 'visual', name: 'Video 2', clips: [star, card] }, { id: 'v1', kind: 'visual', name: 'Video 1', clips: [paper] }], comps: {}, assets: [] };
}

test.describe('p1 paint @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('miter limit and shaped shadow draw on the canvas', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: PORTRAIT });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: paintDoc(), actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    for (const renderer of ['core', 'dom']) {
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}?renderer=${renderer}`);
      await page.waitForTimeout(8000);
      if (SHOTS) {
        await page.screenshot({ path: `${SHOTS}/p1-paint-${renderer}.png`, clip: { x: 340, y: 170, width: 380, height: 430 } });
      }
    }
  });
});
