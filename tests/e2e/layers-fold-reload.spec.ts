import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { createComponent } from '../../src/lib/motion/main-component';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const FRAME_DATA = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

let n = 0;
const newId = () => `fold${++n}`;

const withNav = () => {
  const link = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'Pricing', size: 0.05, x: 0.3, y: 0.1, width: 0.2, height: 0.08 } }, 'link'));
  return must(createComponent(link, ['link'], newId, 'Nav'));
};

test.describe('folds in Layers @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('a folded row stays folded, children hidden, after a reload', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: FRAME_DATA });
    expect((await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: withNav(), actor_kind: 'user', actor_id: session.userId })).error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const layers = page.getByTestId('layers');
    const nav = layers.locator('[role="treeitem"], [data-layer]').filter({ hasText: 'Nav' }).first();
    await expect(nav).toBeVisible({ timeout: 20_000 });
    const below = () => layers.locator('[data-layer="link"]').count();
    await expect.poll(below).toBeGreaterThan(0);

    await nav.getByTestId('layer-fold').click();
    await expect.poll(below).toBe(0);

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    await expect(layers.locator('[data-layer]').filter({ hasText: 'Nav' }).first()).toBeVisible({ timeout: 20_000 });
    await expect.poll(below).toBe(0);
  });
});
