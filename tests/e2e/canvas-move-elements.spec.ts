import { randomUUID } from 'node:crypto';
import type { Page, Locator } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const BAR_H = 44;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

type Clip = { id: string; component: string; props: Record<string, unknown> };
type Doc = { tracks: { clips: Clip[] }[]; links?: Record<string, string> };

const blank = { version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [] }], comps: {}, assets: [] };
const withText = { ...blank, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'txt', from: 0, durationInFrames: 150, component: 'Text', props: { text: 'MOVE ME', size: 0.2, x: 0.5, y: 0.5, width: 0.8, height: 0.4 } }] }] };

async function head(admin: SupabaseClient, nodeId: string): Promise<Doc | null> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  return (data?.[0]?.doc as Doc | undefined) ?? null;
}

const clipIds = (doc: Doc | null) => (doc?.tracks ?? []).flatMap((t) => t.clips.map((c) => `${c.component}:${c.id}`));

async function frame(admin: SupabaseClient, seedNode: (s: { type: string; x: number; y: number; data: Record<string, unknown> }) => Promise<{ id: string }>, session: { orgId: string; userId: string }, at: { x: number; y: number }, doc: unknown) {
  const node = await seedNode({ type: 'motion', ...at, data: LANDSCAPE });
  const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
  expect(error).toBeNull();
  return node.id;
}

const stageOf = (page: Page, nodeId: string) => page.locator(`[data-motion-node="${nodeId}"] [data-frame-stage]`);

async function centre(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function openAndGrab(page: Page, nodeId: string) {
  await stageOf(page, nodeId).click({ position: { x: 60, y: 10 } });
  const overlay = page.getByTestId('selection-overlay');
  await expect(overlay).toBeVisible({ timeout: 15_000 });
  await expect(async () => {
    await overlay.click();
    await expect(page.getByTestId('selection-box')).toBeVisible({ timeout: 1000 });
  }, 'the text selects once the preview has measured it').toPass({ timeout: 15_000 });
  const middle = await centre(overlay);
  return { x: middle.x - 40, y: middle.y + 10 };
}

async function dragTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 20 });
  await page.mouse.up();
}

async function generated(admin: SupabaseClient, session: { orgId: string; projectId: string }, type: 'image' | 'video') {
  const path = `${session.orgId}/${session.projectId}/e2e/${randomUUID()}.png`;
  await admin.storage.from('canvas-assets').upload(path, PNG_1X1, { contentType: 'image/png' });
  const { data, error } = await admin
    .from('assets')
    .insert({ org_id: session.orgId, project_id: session.projectId, type, url: path, mime_type: type === 'image' ? 'image/png' : 'video/mp4', bytes: PNG_1X1.length, width: 1, height: 1, duration_s: type === 'video' ? 3 : null, source: 'upload' })
    .select('id')
    .single();
  expect(error).toBeNull();
  return data!.id as string;
}

test.use({ video: process.env.E2E_VIDEO ? 'on' : 'off' });

test.describe('moving elements between frames @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1 — mai il progetto di produzione');

  test('a text element dragged from frame A to frame B persists in both revisions', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const a = await frame(admin, seedNode, session, { x: 80, y: 80 }, withText);
    const b = await frame(admin, seedNode, session, { x: 700, y: 80 }, blank);

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const from = await openAndGrab(page, a);
    await dragTo(page, from, await centre(stageOf(page, b)));

    await expect.poll(async () => clipIds(await head(admin, b)), { timeout: 10_000 }).toEqual(['Text:txt']);
    await expect.poll(async () => clipIds(await head(admin, a)), { timeout: 10_000 }).toEqual([]);
  });

  test('dropped on the empty canvas it becomes a new frame holding only that element', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const a = await frame(admin, seedNode, session, { x: 80, y: 80 }, withText);

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const from = await openAndGrab(page, a);
    const viewport = page.viewportSize()!;
    await dragTo(page, from, { x: viewport.width - 120, y: viewport.height - 120 });

    await expect.poll(async () => clipIds(await head(admin, a)), { timeout: 10_000 }).toEqual([]);
    const { data: frames } = await admin.from('nodes').select('id').eq('canvas_id', session.canvasId).eq('type', 'motion').is('deleted_at', null).neq('id', a);
    expect(frames).toHaveLength(1);
    expect(clipIds(await head(admin, frames![0].id))).toEqual(['Text:txt']);

    const made = (await head(admin, frames![0].id)) as Doc & { width: number; height: number };
    const { data: node } = await admin.from('nodes').select('width, height').eq('id', frames![0].id).single();
    expect(made.width / made.height, 'the new frame takes the element shape').toBeGreaterThan(16 / 9 + 0.5);
    expect(Math.abs(Number(node!.height) - BAR_H - (Number(node!.width) * made.height) / made.width), 'the node is the shape of its frame, no letterbox').toBeLessThanOrEqual(1);
  });

  test('cmd+Z in the open editor after a move to another frame undoes both frames', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const a = await frame(admin, seedNode, session, { x: 80, y: 80 }, withText);
    const b = await frame(admin, seedNode, session, { x: 700, y: 80 }, blank);

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const from = await openAndGrab(page, a);
    const moved = page.waitForResponse((r) => r.url().includes('?/moveElement'));
    await dragTo(page, from, await centre(stageOf(page, b)));
    await moved;
    await expect.poll(async () => clipIds(await head(admin, b)), { timeout: 10_000 }).toEqual(['Text:txt']);
    await expect.poll(async () => clipIds(await head(admin, a)), { timeout: 10_000 }).toEqual([]);

    await page.keyboard.press('Meta+z');
    await expect.poll(async () => clipIds(await head(admin, a)), { timeout: 10_000 }).toEqual(['Text:txt']);
    await expect.poll(async () => clipIds(await head(admin, b)), { timeout: 10_000 }).toEqual([]);
  });

  for (const type of ['image', 'video'] as const) {
    test(`a generated ${type} dragged into a frame becomes a ${type} element; the node is unchanged`, async ({ page, session, admin, seedNode }) => {
      test.setTimeout(120_000);
      const assetId = await generated(admin, session, type);
      const gen = await seedNode({ type, x: 80, y: 520, data: { prompt: `a ${type}`, refId: assetId } });
      const b = await frame(admin, seedNode, session, { x: 700, y: 80 }, blank);
      const before = await admin.from('nodes').select('data, version').eq('id', gen.id).single();

      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await page.locator(`[data-id="${gen.id}"] .gen-body`).hover();
      await page.getByTestId('drag-to-frame').dragTo(stageOf(page, b));

      const component = type === 'image' ? 'Image' : 'Video';
      await expect.poll(async () => (await head(admin, b))?.tracks.flatMap((t) => t.clips).map((c) => [c.component, c.props.assetId]), { timeout: 10_000 }).toEqual([[component, assetId]]);
      const after = await admin.from('nodes').select('data, version').eq('id', gen.id).single();
      expect(after.data).toEqual(before.data);
    });
  }

  test('an image node connected to a frame shows its picture as an element in it', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const assetId = await generated(admin, session, 'image');
    const gen = await seedNode({ type: 'image', x: 80, y: 520, data: { prompt: 'a cat', refId: assetId } });
    const b = await frame(admin, seedNode, session, { x: 700, y: 80 }, blank);

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const answer = await page.evaluate(
      async ({ source, target }) => {
        const body = new FormData();
        body.set('source_node_id', source);
        body.set('target_node_id', target);
        body.set('kind', 'derives_from');
        const res = await fetch(`${location.pathname}?/connect`, { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
        return res.ok;
      },
      { source: gen.id, target: b }
    );
    expect(answer).toBe(true);

    await expect.poll(async () => (await head(admin, b))?.links?.[gen.id] ?? null, { timeout: 10_000 }).not.toBeNull();
    expect((await head(admin, b))?.tracks.flatMap((t) => t.clips).map((c) => c.props.assetId)).toEqual([assetId]);
  });
});
