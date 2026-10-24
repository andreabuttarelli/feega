import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { SHOT_PREFIX } from './fixtures/shots';

const SETTLE_MS = 2500;
const SAVED_MS = 25_000;
const DATA = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 's', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.3, height: 0.3, fills: [{ type: 'solid', color: '#ff5a1f' }] } }] }],
  comps: {},
  assets: []
};

test.describe('sections @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  async function setup(page: import('@playwright/test').Page, session: { orgId: string; userId: string; projectId: string; canvasId: string }, admin: import('@supabase/supabase-js').SupabaseClient, seedNode: (n: Record<string, unknown>) => Promise<{ id: string }>) {
    await page.setViewportSize({ width: 1440, height: 900 });
    const first = await seedNode({ type: 'motion', x: 0, y: 0, data: DATA });
    const second = await seedNode({ type: 'motion', x: 460, y: 0, data: DATA });
    for (const node of [first, second]) {
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
    }
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);
    const centre = async (id: string) => {
      const b = (await page.locator(`[data-frame="${id}"]`).boundingBox())!;
      return { x: b.x + b.width / 2, y: b.y + b.height * 0.15 };
    };
    const a = await centre(first.id);
    const b = await centre(second.id);
    await page.mouse.click(a.x, a.y);
    await page.keyboard.down('Shift');
    await page.mouse.click(b.x, b.y);
    await page.keyboard.up('Shift');
    await page.keyboard.press('Shift+s');
    return { first, second };
  }

  const rows = (admin: import('@supabase/supabase-js').SupabaseClient, canvasId: string) =>
    admin.from('nodes').select('id,type,deleted_at,data').eq('canvas_id', canvasId).then(({ data }) => data ?? []);

  test('Shift+S wraps the selected frames in a section they join', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const { first, second } = await setup(page, session, admin, seedNode as never);

    await expect.poll(async () => (await rows(admin, session.canvasId)).filter((n) => n.type === 'section').length, { timeout: SAVED_MS }).toBe(1);
    const all = await rows(admin, session.canvasId);
    const section = all.find((n) => n.type === 'section')!;
    await expect.poll(async () => (await rows(admin, session.canvasId)).filter((n) => (n.data as { groupId?: string }).groupId === section.id).map((n) => n.id).sort(), { timeout: SAVED_MS }).toEqual([first.id, second.id].sort());
    await page.screenshot({ path: `${SHOT_PREFIX}-st04-section.png` });
  });

  test('Cmd+Backspace deletes the section and keeps the frames', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const { first, second } = await setup(page, session, admin, seedNode as never);
    await expect.poll(async () => (await rows(admin, session.canvasId)).filter((n) => n.type === 'section').length, { timeout: SAVED_MS }).toBe(1);
    await page.waitForTimeout(SETTLE_MS);

    const section = (await rows(admin, session.canvasId)).find((n) => n.type === 'section')!;
    const title = page.locator(`[data-id="${section.id}"]`);
    const box = (await title.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.5, box.y + 8);
    await page.keyboard.press('ControlOrMeta+Backspace');

    await expect.poll(async () => (await rows(admin, session.canvasId)).filter((n) => n.type === 'section' && !n.deleted_at).length, { timeout: SAVED_MS }).toBe(0);
    const left = (await rows(admin, session.canvasId)).filter((n) => !n.deleted_at).map((n) => n.id).sort();
    expect(left).toEqual([first.id, second.id].sort());
    await page.screenshot({ path: `${SHOT_PREFIX}-st04-kept.png` });
  });
});
