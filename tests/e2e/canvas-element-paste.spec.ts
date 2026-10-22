import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { SupabaseClient } from '@supabase/supabase-js';

const SETTLE_MS = 2500;
const ELEMENT_X = 0.3;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };

type Doc = { tracks: { clips: { id: string; props: Record<string, unknown> }[] }[] };

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

async function head(admin: SupabaseClient, nodeId: string): Promise<Doc | null> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  return (data?.[0]?.doc as Doc | undefined) ?? null;
}

const clipCount = async (admin: SupabaseClient, nodeId: string) => (await head(admin, nodeId))?.tracks.flatMap((t) => t.clips).length ?? 0;

test.describe('copy and paste elements @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('⌘C ⌘V copies an element inside its frame, and onto the canvas as a free element', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: frameDoc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);
    const stage = (await page.locator(`[data-frame="${frame.id}"]`).boundingBox())!;
    const element = { x: stage.x + stage.width * ELEMENT_X, y: stage.y + stage.height / 2 };
    await page.mouse.click(element.x, element.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(element.x, element.y);
    await expect(page.getByTestId('frame-selection')).toHaveCount(1, { timeout: 15_000 });
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+c');
    await page.keyboard.press('ControlOrMeta+v');
    await expect.poll(() => clipCount(admin, frame.id), { timeout: 15_000 }).toBe(2);

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.locator('.svelte-flow__pane').click({ position: { x: 10, y: 10 } });
    await page.keyboard.press('ControlOrMeta+v');
    const elements = async () => (await admin.from('nodes').select('id, data').eq('canvas_id', session.canvasId).is('deleted_at', null)).data?.filter((n) => (n.data as { kind?: string }).kind === 'element') ?? [];
    await expect.poll(async () => (await elements()).length, { timeout: 15_000 }).toBeGreaterThan(0);
    expect(await clipCount(admin, frame.id)).toBe(2);
  });

  test('⌘V with a frame selected pastes a copied free element into it and keeps the original', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const free = await seedNode({ type: 'motion', x: 900, y: 80, data: { ...LANDSCAPE, kind: 'element' } });
    for (const id of [frame.id, free.id]) {
      const doc = id === frame.id ? { ...frameDoc, tracks: [{ ...frameDoc.tracks[0], clips: [] }] } : { ...frameDoc, background: 'transparent' };
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
    }

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator(`.svelte-flow__node[data-id="${free.id}"]`).click({ position: { x: 4, y: 4 } });
    await page.keyboard.press('ControlOrMeta+c');
    await page.locator(`.svelte-flow__node[data-id="${frame.id}"]`).click({ position: { x: 4, y: 4 } });
    await page.keyboard.press('ControlOrMeta+v');

    await expect.poll(() => clipCount(admin, frame.id), { timeout: 15_000 }).toBe(1);
    const kept = await admin.from('nodes').select('deleted_at').eq('id', free.id).single();
    expect(kept.data?.deleted_at).toBeNull();
  });
});
