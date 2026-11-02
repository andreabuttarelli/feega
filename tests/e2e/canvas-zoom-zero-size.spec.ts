import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const FRAME_DATA = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SETTLE_MS = 3000;

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const withEmptyButton = () => {
  const bg = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, fills: [{ type: 'solid', color: '#1f5eff' }] } }, 'bg'));
  const doc = must(addClip(bg, { component: 'Shape', from: 0, durationInFrames: 90, props: { shape: 'rect', x: 0.3, y: 0.2, width: 0.1, height: 0.1, fills: [{ type: 'solid', color: '#ffffff' }] } }, 'nav-button'));
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'nav-button' ? { ...c, props: { ...c.props, width: 0, height: 0 } } : c)) })) };
};

test.describe('zoom to a zero-size selection @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('⇧2 on a 0×0 element keeps the GPU canvas drawing', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: FRAME_DATA });
    expect((await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: withEmptyButton(), actor_kind: 'user', actor_id: session.userId })).error).toBeNull();
    const failures: string[] = [];
    page.on('console', (m) => /unreachable|core off|gpu lost/i.test(m.text()) && failures.push(m.text().slice(0, 200)));

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const layers = page.getByTestId('layers');
    await layers.locator(`[data-layer="${frame.id}"]`).click();
    await layers.locator('[data-layer="nav-button"]').click();
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.move(700, 450);
    await page.keyboard.press('Shift+Digit2');
    await page.waitForTimeout(SETTLE_MS);

    const view = (await page.locator('[data-canvas-surface]').getAttribute('data-view'))!.split(',').map(Number);
    expect(view.every(Number.isFinite), `view ${view}`).toBe(true);
    await expect(page.locator('.edge-refusal')).toHaveCount(0);
    expect(failures).toEqual([]);
  });
});
