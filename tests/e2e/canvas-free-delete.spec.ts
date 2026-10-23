import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated, type E2eSession } from './fixtures/session';

const SHOTS = process.env.CANVAS_FREE_SHOTS;
const DRAWN = ['rectangle', 'ellipse', 'line', 'text'] as const;
const DELETE_KEYS = ['Delete', 'Backspace'] as const;

const PICTURE_DOC = {
  version: 5,
  fps: 30,
  width: 400,
  height: 300,
  durationInFrames: 150,
  background: 'transparent',
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'pic', from: 0, durationInFrames: 150, component: 'Image', props: { assetId: null, fit: 'cover', x: 0, y: 0, width: 1, height: 1 } }] }],
  comps: {},
  assets: []
};

async function liveNodes(admin: SupabaseClient, session: E2eSession): Promise<string[]> {
  const { data } = await admin.from('nodes').select('id').eq('canvas_id', session.canvasId).is('deleted_at', null);
  return (data ?? []).map((n) => n.id);
}

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/free-${name}.png` });
  }
}

async function draw(page: Page, tool: string) {
  await pickBarTool(page, tool);
  const pane = (await page.locator('.svelte-flow').boundingBox())!;
  const from = { x: pane.x + pane.width * 0.4, y: pane.y + pane.height * 0.4 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 100, from.y + 60);
  await page.mouse.move(from.x + 200, from.y + 120);
  await page.mouse.up();
}

test.describe('deleting a free element deletes the element @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  for (const [i, tool] of DRAWN.entries()) {
    const key = DELETE_KEYS[i % DELETE_KEYS.length];
    test(`a ${tool} selected and deleted with ${key} leaves no node behind`, async ({ page, session, admin }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);

      await draw(page, tool);
      await expect.poll(() => liveNodes(admin, session).then((n) => n.length), { timeout: 10_000 }).toBe(1);
      const [id] = await liveNodes(admin, session);
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      const pane = (await page.locator('.svelte-flow').boundingBox())!;
      await page.mouse.click(pane.x + 20, pane.y + pane.height - 120);
      await page.locator(`[data-motion-node="${id}"]`).click();
      await shoot(page, `${tool}-selected`);

      await page.keyboard.press(key);
      await expect.poll(() => liveNodes(admin, session).then((n) => n.length), { timeout: 10_000 }).toBe(0);
      await expect(page.locator(`[data-motion-node="${id}"]`)).toHaveCount(0);
      await expect(page.locator(`[data-testid="gpu-node"][data-id="${id}"]`)).toHaveCount(0);
      await shoot(page, `${tool}-deleted`);

      await page.keyboard.press('ControlOrMeta+z');
      await expect.poll(() => liveNodes(admin, session).then((n) => n.length), { timeout: 10_000 }).toBe(1);
    });
  }

  test('a free image deleted with Delete leaves no node behind', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const free = await seedNode({ type: 'motion', x: 200, y: 200, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, kind: 'element' } });
    await admin.from('nodes').update({ width: 200, height: 150 }).eq('id', free.id);
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: free.id, version: 1, doc: PICTURE_DOC, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator(`[data-motion-node="${free.id}"]`).click();
    await page.keyboard.press('Delete');
    await expect.poll(() => liveNodes(admin, session).then((n) => n.length), { timeout: 10_000 }).toBe(0);
    await expect(page.locator(`[data-motion-node="${free.id}"]`)).toHaveCount(0);
    await shoot(page, 'image-deleted');
  });
});
