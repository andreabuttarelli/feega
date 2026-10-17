import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';

const SHOTS = process.env.CANVAS_MOTION_SHOTS;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };

type Clip = { id: string; component: string; props: Record<string, unknown> };
type Doc = { tracks: { clips: Clip[] }[]; comps?: Record<string, unknown> };

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

const sheet = (id: string, shape: string) => ({
  version: 5,
  fps: 30,
  width: 200,
  height: 200,
  durationInFrames: 150,
  background: 'transparent',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id, from: 0, durationInFrames: 150, component: 'Shape', props: { shape, x: 0.5, y: 0.5, width: 1, height: 1 } }] }],
  comps: {},
  assets: []
});

async function head(admin: SupabaseClient, nodeId: string): Promise<Doc | null> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  return (data?.[0]?.doc as Doc | undefined) ?? null;
}

test.use({ video: process.env.E2E_VIDEO ? 'on' : 'off' });

test.describe('groups @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('⌘G groups two free elements into one Group, ⇧⌘G gives them back', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const ids: string[] = [];
    for (const [i, shape] of ['rect', 'ellipse'].entries()) {
      const node = await seedNode({ type: 'motion', x: 120 + i * 220, y: 160, data: { ...LANDSCAPE, kind: 'element' } });
      await admin.from('nodes').update({ width: 120, height: 120 }).eq('id', node.id);
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: sheet(`s${i}`, shape), actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
      ids.push(node.id);
    }
    const alive = async () => (await admin.from('nodes').select('id, display_name').eq('canvas_id', session.canvasId).is('deleted_at', null)).data ?? [];

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator(`[data-motion-node="${ids[0]}"]`).click();
    await page.keyboard.press('Escape');
    await page.locator('.svelte-flow__pane').click({ position: { x: 10, y: 10 } });
    await page.keyboard.press('ControlOrMeta+a');
    await shoot(page, '1-two-selected');
    await page.keyboard.press('ControlOrMeta+g');

    await expect.poll(async () => (await alive()).map((n) => n.display_name), { timeout: 10_000 }).toEqual(['Group']);
    const [group] = await alive();
    await expect.poll(async () => (await head(admin, group.id))?.tracks.flatMap((t) => t.clips.map((c) => c.id)).sort(), { timeout: 10_000 }).toEqual(['s0', 's1']);
    await page.locator('.svelte-flow__pane').click({ position: { x: 10, y: 10 } });
    await shoot(page, '2-grouped');
    const groupTile = page.locator(`[data-motion-node="${group.id}"]`);
    await groupTile.click();
    await expect(page.getByTestId('motion-editor'), 'a click selects the group, it does not enter it').toHaveCount(0);
    await groupTile.dblclick();
    await expect(page.getByTestId('motion-editor'), 'a double-click enters the group').toBeVisible({ timeout: 15_000 });
    await shoot(page, '2b-inside-group');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.locator('.svelte-flow__pane').click({ position: { x: 10, y: 10 } });

    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+Shift+g');
    await expect.poll(async () => (await alive()).map((n) => n.display_name).sort(), { timeout: 10_000 }).toEqual(['Box', 'Ellipse']);
    await shoot(page, '3-ungrouped');
  });

  test('the toolbar groups two elements and the right-click menu ungroups them', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    for (const [i, shape] of ['rect', 'ellipse'].entries()) {
      const node = await seedNode({ type: 'motion', x: 120 + i * 220, y: 160, data: { ...LANDSCAPE, kind: 'element' } });
      await admin.from('nodes').update({ width: 120, height: 120 }).eq('id', node.id);
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: sheet(`t${i}`, shape), actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
    }
    const alive = async () => (await admin.from('nodes').select('id, display_name').eq('canvas_id', session.canvasId).is('deleted_at', null)).data ?? [];

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator('.svelte-flow__pane').click({ position: { x: 10, y: 10 } });
    await page.keyboard.press('ControlOrMeta+a');
    const toolbar = page.getByRole('toolbar', { name: 'Selection actions' });
    await toolbar.getByRole('button', { name: 'Group', exact: true }).click();
    await expect.poll(async () => (await alive()).map((n) => n.display_name), { timeout: 10_000 }).toEqual(['Group']);
    const [group] = await alive();

    await page.locator('.svelte-flow__pane').click({ position: { x: 10, y: 10 } });
    await page.locator(`[data-motion-node="${group.id}"]`).click({ button: 'right' });
    const menu = page.getByTestId('canvas-menu');
    await expect(menu.getByRole('menuitem', { name: /Duplicate/ })).toBeVisible();
    await shoot(page, '5-context-menu');
    await menu.getByRole('menuitem', { name: /^Ungroup/ }).click();
    await expect.poll(async () => (await alive()).map((n) => n.display_name).sort(), { timeout: 10_000 }).toEqual(['Box', 'Ellipse']);

    const box = (await alive()).find((n) => n.display_name === 'Box')!;
    await page.locator('.svelte-flow__pane').click({ position: { x: 10, y: 10 } });
    await page.locator(`[data-motion-node="${box.id}"]`).click({ button: 'right' });
    await menu.getByRole('menuitem', { name: /^Send to back/ }).click();
    const zOf = async () => (await admin.from('nodes').select('id, z').eq('canvas_id', session.canvasId).is('deleted_at', null)).data ?? [];
    await expect.poll(async () => { const rows = await zOf(); return rows.find((r) => r.id === box.id)!.z < Math.min(...rows.filter((r) => r.id !== box.id).map((r) => r.z)); }, { timeout: 10_000 }).toBe(true);
  });

  test('inside a frame ⌘G makes a group clip and ⇧⌘G undoes it', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const two = { ...sheet('a', 'rect'), width: 1920, height: 1080, background: 'brand', tracks: [{ ...sheet('a', 'rect').tracks[0], clips: [{ ...sheet('a', 'rect').tracks[0].clips[0], props: { shape: 'rect', x: 0.3, y: 0.5, width: 0.2, height: 0.2 } }, { ...sheet('b', 'ellipse').tracks[0].clips[0], props: { shape: 'ellipse', x: 0.7, y: 0.5, width: 0.2, height: 0.2 } }] }] };
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: two, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator(`[data-motion-node="${frame.id}"] [data-frame-stage]`).click({ position: { x: 4, y: 4 } });
    await expect(page.getByTestId('selection-overlay')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('selection-overlay').click({ position: { x: 4, y: 4 } });
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+g');
    await expect.poll(async () => (await head(admin, frame.id))?.tracks.flatMap((t) => t.clips.map((c) => c.component)), { timeout: 10_000 }).toEqual(['Precomp']);
    await page.keyboard.press('ControlOrMeta+Shift+g');
    await expect.poll(async () => (await head(admin, frame.id))?.tracks.flatMap((t) => t.clips.map((c) => c.id)).sort(), { timeout: 10_000 }).toEqual(['a', 'b']);
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+g');
    await expect.poll(async () => (await head(admin, frame.id))?.tracks.flatMap((t) => t.clips.map((c) => c.component)), { timeout: 10_000 }).toEqual(['Precomp']);
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    await expect(page.getByTestId('layers').getByTestId('layer-fold')).not.toHaveCount(0);
    await shoot(page, '4-frame-group-layers');

  });
});
