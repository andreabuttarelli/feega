import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import instance from './fixtures/motion-doc-template-instance.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SHOTS = process.env.SHOT_PREFIX ?? '';
const TILE_AT = { x: 200, y: 80 };
const SETTLE_MS = 1500;
const MORE = 'More actions';
const PEER = { userId: 'e2e-peer', name: 'peer@feega.app' };
const PEER_AT = { x: 0.25, y: 0.75 };
const ALIGN_PX = 4;

const shape = (id: string, x: number, color: string) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x, y: 0.5, width: 0.25, height: 0.4, fills: [{ type: 'solid', color }] } });

const video = { version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, background: 'brand', tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [shape('first', 0.3, '#ff5a1f')] }], comps: {}, assets: [] };
const still = { ...video, still: { frame: 0 } };

async function seedFrame(seedNode: (s: { type: string; x: number; y: number; data: object }) => Promise<{ id: string }>, admin: SupabaseClient, session: { orgId: string; userId: string }, doc: object) {
  const node = await seedNode({ type: 'motion', x: TILE_AT.x, y: TILE_AT.y, data: LANDSCAPE });
  const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
  expect(error).toBeNull();
  return node.id;
}

async function openFrame(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('[data-canvas-surface]')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(4000);
  const tile = page.locator('[data-testid="gpu-node"][data-kind="motion"]').first();
  await expect(async () => {
    const box = (await tile.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.5);
    await expect(page.getByTestId('frame-timeline')).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 25_000 });
  await page.waitForTimeout(SETTLE_MS);
}

async function pickMore(page: Page, label: string) {
  await page.getByRole('button', { name: MORE }).click();
  await page.getByRole('menuitem', { name: label }).click();
}

async function peerChannel(admin: SupabaseClient, canvasId: string) {
  const { data } = await admin.auth.getSession();
  await admin.realtime.setAuth(data.session!.access_token);
  const channel = admin.channel(`canvas:${canvasId}`, { config: { private: true } });
  await new Promise<void>((done) => channel.subscribe((status) => status === 'SUBSCRIBED' && done()));
  return channel;
}

test.describe('publish, template and peers from a selected canvas frame @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('template, publish dialogs and a peer cursor that stays on its spot at any zoom', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    const nodeId = await seedFrame(seedNode, admin, session, video);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await openFrame(page);

    await pickMore(page, 'Save as template…');
    await expect(page.getByTestId('template-dialog')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}-01-save-template.png` });
    await page.getByTestId('template-dialog').getByRole('button', { name: 'Close' }).click();

    await pickMore(page, 'Publish to gallery…');
    await expect(page.getByTestId('publish-dialog')).toBeVisible();
    await page.getByTestId('publish-title').fill('Not published: e2e');
    await page.screenshot({ path: `${SHOTS}-02-publish.png` });
    await page.getByTestId('publish-dialog').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('publish-dialog')).toBeHidden();

    const channel = await peerChannel(admin, session.canvasId);
    const beat = setInterval(() => void channel.send({ type: 'broadcast', event: 'frame', payload: { ...PEER, nodeId, cursor: PEER_AT, selection: ['first'], at: Date.now() } }), 500);
    try {
      const cursor = page.getByTestId('peer-cursor');
      await expect(cursor).toBeVisible({ timeout: 10_000 });
      const aligned = async () => {
        const frame = (await page.locator(`[data-frame="${nodeId}"]`).boundingBox())!;
        const at = (await cursor.boundingBox())!;
        expect(Math.abs(at.x - (frame.x + frame.width * PEER_AT.x))).toBeLessThanOrEqual(ALIGN_PX);
        expect(Math.abs(at.y - (frame.y + frame.height * PEER_AT.y))).toBeLessThanOrEqual(ALIGN_PX);
      };
      await aligned();
      await page.screenshot({ path: `${SHOTS}-03-peer.png` });

      await page.mouse.move(700, 450);
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, -60);
      await page.keyboard.up('Control');
      await page.mouse.wheel(60, 40);
      await page.waitForTimeout(SETTLE_MS);
      await aligned();
      await page.screenshot({ path: `${SHOTS}-04-peer-zoomed.png` });
    } finally {
      clearInterval(beat);
      await admin.removeChannel(channel);
    }
  });

  test('a still frame exports as an image', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    await seedFrame(seedNode, admin, session, still);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await openFrame(page);

    await pickMore(page, 'Export…');
    await expect(page.getByTestId('still-export')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}-05-still-export.png` });
  });

  test('a template instance shows its fields in the properties', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    await seedFrame(seedNode, admin, session, instance);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await openFrame(page);

    await page.getByTestId('frame-timeline').getByRole('button', { name: /card4/ }).first().click();
    await expect(page.getByTestId('template-inspector')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}-06-template-inspector.png` });
  });
});
