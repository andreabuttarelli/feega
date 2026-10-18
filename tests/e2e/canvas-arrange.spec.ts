import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { SupabaseClient } from '@supabase/supabase-js';

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SIDE = 120;

const sheet = (id: string) => ({
  version: 5,
  fps: 30,
  width: 200,
  height: 200,
  durationInFrames: 150,
  background: 'transparent',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id, from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1 } }] }],
  comps: {},
  assets: []
});

async function positions(admin: SupabaseClient, canvasId: string) {
  const { data } = await admin.from('nodes').select('id, x, y').eq('canvas_id', canvasId).is('deleted_at', null);
  return new Map((data ?? []).map((n) => [n.id, { x: Number(n.x), y: Number(n.y) }]));
}

test.describe('arrange on the canvas @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('right-click aligns tiles, ⌃⌥T tidies them, a drag snaps with a guide', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const ids: string[] = [];
    for (const [i, y] of [160, 230, 190].entries()) {
      const node = await seedNode({ type: 'motion', x: 100 + i * 200, y, data: { ...LANDSCAPE, kind: 'element' } });
      await admin.from('nodes').update({ width: SIDE, height: SIDE }).eq('id', node.id);
      await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: sheet(`s${i}`), actor_kind: 'user', actor_id: session.userId });
      ids.push(node.id);
    }

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator('.svelte-flow__pane').click({ position: { x: 10, y: 10 } });
    await page.keyboard.press('ControlOrMeta+a');
    await page.locator(`[data-motion-node="${ids[1]}"]`).click({ button: 'right' });
    await page.getByTestId('canvas-menu').locator('[data-action="align-top"]').click();
    await expect.poll(async () => [...(await positions(admin, session.canvasId)).values()].map((p) => p.y), { timeout: 10_000 }).toEqual([160, 160, 160]);

    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Control+Alt+t');
    await expect
      .poll(async () => {
        const at = await positions(admin, session.canvasId);
        const xs = ids.map((id) => at.get(id)!.x);
        return xs[2] - xs[1] === xs[1] - xs[0];
      }, { timeout: 10_000 })
      .toBe(true);

    await page.locator('.svelte-flow__pane').click({ position: { x: 10, y: 10 } });
    const tile = page.locator(`[data-motion-node="${ids[2]}"]`);
    const box = (await tile.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 63, { steps: 8 });
    await page.mouse.move(box.x + box.width / 2 + 22, box.y + box.height / 2 + 3, { steps: 4 });
    await expect(page.getByTestId('snap-guide').first()).toBeVisible();
    await page.mouse.up();
    await expect(page.getByTestId('snap-guide')).toHaveCount(0);
    await expect.poll(async () => (await positions(admin, session.canvasId)).get(ids[2])!.y, { timeout: 10_000 }).toBe(160);
  });
});
