import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { pickBarTool } from './fixtures/canvas-bar';
import { hoverTile } from './fixtures/canvas-tile';
import { test, expect, REAL_STACK, gotoHydrated, type E2eSession } from './fixtures/session';

const SHOTS = process.env.CANVAS_ELEMENT_SHOTS;
const DRAWN = ['rectangle', 'text', 'line'] as const;
const ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" fill="#ff3b30"/><circle cx="12" cy="12" r="6" fill="#0a84ff"/></svg>';
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const BLANK = { version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [] }], comps: {}, assets: [] };
const WITH_TEXT = { ...BLANK, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'txt', from: 0, durationInFrames: 150, component: 'Text', props: { text: 'MOVE ME', size: 0.2, x: 0.5, y: 0.5, width: 0.8, height: 0.4 } }] }] };

type Row = { id: string; type: string };
type Clip = { component: string };
type Seed = (s: { type: string; x: number; y: number; data: Record<string, unknown> }) => Promise<{ id: string }>;

async function live(admin: SupabaseClient, session: E2eSession): Promise<Row[]> {
  const { data } = await admin.from('nodes').select('id, type').eq('canvas_id', session.canvasId).is('deleted_at', null);
  return data ?? [];
}

const typesOf = async (admin: SupabaseClient, session: E2eSession, except: string[] = []) => (await live(admin, session)).filter((r) => !except.includes(r.id)).map((r) => r.type);

async function clipsOf(admin: SupabaseClient, nodeId: string): Promise<string[]> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  return ((data?.[0]?.doc as { tracks: { clips: Clip[] }[] } | undefined)?.tracks ?? []).flatMap((t) => t.clips.map((c) => c.component));
}

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/free2-${name}.png` });
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

async function centre(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function dragTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 20 });
  await page.mouse.up();
}

async function seeded(admin: SupabaseClient, seedNode: Seed, session: E2eSession, node: { type: string; x: number; y: number; data: Record<string, unknown> }, doc: unknown) {
  const made = await seedNode(node);
  const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: made.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
  expect(error).toBeNull();
  return made.id;
}

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test.describe('free elements are element nodes @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  for (const tool of DRAWN) {
    test(`a drawn ${tool} is an element node; Delete removes it, cmd+Z brings it back`, async ({ page, session, admin }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);

      await draw(page, tool);
      await expect.poll(() => typesOf(admin, session), { timeout: 10_000 }).toEqual(['element']);
      const [{ id }] = await live(admin, session);
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      const pane = (await page.locator('.svelte-flow').boundingBox())!;
      await page.mouse.click(pane.x + 20, pane.y + pane.height - 120);
      await page.locator(`[data-motion-node="${id}"]`).click();
      await shoot(page, `${tool}-selected`);

      await page.keyboard.press('Delete');
      await expect.poll(() => typesOf(admin, session), { timeout: 10_000 }).toEqual([]);
      await expect(page.locator(`[data-motion-node="${id}"]`)).toHaveCount(0);

      await page.keyboard.press('ControlOrMeta+z');
      await expect.poll(() => typesOf(admin, session), { timeout: 10_000 }).toEqual(['element']);
      await shoot(page, `${tool}-restored`);
    });
  }

  test('a pasted svg lands as an element node', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.evaluate(async (svg) => navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([svg], { type: 'text/plain' }) })]), ICON);
    const pane = (await page.locator('.svelte-flow').boundingBox())!;
    await page.mouse.click(pane.x + pane.width / 2, pane.y + pane.height / 2);
    await page.keyboard.press('ControlOrMeta+v');

    await expect.poll(() => typesOf(admin, session), { timeout: 20_000 }).toEqual(['element']);
    await page.waitForTimeout(1500);
    await shoot(page, 'svg-pasted');
  });

  test('an element dragged out of a frame is an element node', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const a = await seeded(admin, seedNode, session, { type: 'motion', x: 80, y: 80, data: LANDSCAPE }, WITH_TEXT);

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${a}"]`);
    await expect(host).toBeVisible({ timeout: 20_000 });
    const selection = page.getByTestId('frame-selection');
    const at = await centre(host);
    await expect(async () => {
      await page.mouse.click(at.x, at.y);
      await expect(selection).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 25_000 });
    const viewport = page.viewportSize()!;
    await dragTo(page, await centre(selection), { x: viewport.width - 120, y: viewport.height - 120 });

    await expect.poll(() => typesOf(admin, session, [a]), { timeout: 10_000 }).toEqual(['element']);
    await shoot(page, 'dragged-out');
  });

  test('a generated image dropped on the canvas is an element node', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const path = `${session.orgId}/${session.projectId}/e2e/${randomUUID()}.png`;
    await admin.storage.from('canvas-assets').upload(path, PNG_1X1, { contentType: 'image/png' });
    const { data: asset } = await admin.from('assets').insert({ org_id: session.orgId, project_id: session.projectId, type: 'image', url: path, mime_type: 'image/png', bytes: PNG_1X1.length, width: 1, height: 1, source: 'upload' }).select('id').single();
    const gen = await seedNode({ type: 'image', x: 80, y: 520, data: { prompt: 'an image', refId: asset!.id } });

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await hoverTile(page, gen.id);
    const viewport = page.viewportSize()!;
    await page.getByTestId('drag-to-frame').dragTo(page.locator('.svelte-flow__pane'), { targetPosition: { x: viewport.width / 2, y: 120 } });

    await expect.poll(() => typesOf(admin, session, [gen.id]), { timeout: 10_000 }).toEqual(['element']);
    const [made] = (await live(admin, session)).filter((r) => r.id !== gen.id);
    await expect.poll(() => clipsOf(admin, made.id), { timeout: 10_000 }).toEqual(['Image']);
    await shoot(page, 'image-placed');
  });

  test('an element node dragged onto a frame goes inside it', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const b = await seeded(admin, seedNode, session, { type: 'motion', x: 700, y: 80, data: LANDSCAPE }, BLANK);
    const free = await seeded(admin, seedNode, session, { type: 'element', x: 120, y: 120, data: { docHeadRevision: 1 } }, { ...WITH_TEXT, width: 400, height: 160, background: 'transparent' });
    await admin.from('nodes').update({ width: 200, height: 80 }).eq('id', free);

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await dragTo(page, await centre(page.locator(`[data-motion-node="${free}"]`)), await centre(page.locator(`[data-motion-node="${b}"] [data-frame-stage]`)));

    await expect.poll(() => clipsOf(admin, b), { timeout: 10_000 }).toEqual(['Text']);
    await expect.poll(() => typesOf(admin, session), { timeout: 10_000 }).toEqual(['motion']);
    await shoot(page, 'moved-in');
  });
});
