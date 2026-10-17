import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated, type E2eSession } from './fixtures/session';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const RENDERER = process.env.GPU_RENDERER ?? 'webgpu';
const ROW = { y: 80 };

type Box = { x: number; y: number; w: number; h: number };

async function open(page: Page, s: E2eSession) {
  await gotoHydrated(page, `/p/${s.projectId}/c/${s.canvasId}?renderer=${RENDERER}`);
  await expect(page.getByTestId('gpu-canvas')).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await page.locator('[data-canvas-surface]').getAttribute('data-renderer')) !== 'pending').toBe(true);
}

async function view(page: Page) {
  const [x, y, zoom] = ((await page.locator('[data-canvas-surface]').getAttribute('data-view')) ?? '0,0,1').split(',').map(Number);
  const host = (await page.locator('[data-canvas-surface]').boundingBox())!;
  return { x, y, zoom, left: host.x, top: host.y };
}

async function boxOf(page: Page, id: string): Promise<Box> {
  const [x, y, w, h] = ((await page.locator(`[data-testid="gpu-node"][data-id="${id}"]`).getAttribute('data-box')) ?? '').split(',').map(Number);
  return { x, y, w, h };
}

async function screen(page: Page, world: { x: number; y: number }) {
  const v = await view(page);
  return { x: v.left + v.x + world.x * v.zoom, y: v.top + v.y + world.y * v.zoom };
}

async function centreOf(page: Page, id: string) {
  const b = await boxOf(page, id);
  return screen(page, { x: b.x + b.w / 2, y: b.y + b.h - 20 });
}

const selected = (page: Page) => page.locator('[data-testid="gpu-node"][aria-pressed="true"]');

async function row(admin: SupabaseClient, id: string) {
  return (await admin.from('nodes').select('x, y, deleted_at').eq('id', id).single()).data!;
}

test.describe('GPU canvas: the same gestures as the DOM canvas @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('select, drag, marquee, connect, menu delete', async ({ page, session, admin, seedNode }) => {
    const doc = await seedNode({ type: 'doc', x: 0, y: ROW.y, data: { content: 'Brief', public: false } });
    const text = await seedNode({ type: 'text', x: 600, y: ROW.y, data: { prompt: 'hooks' } });
    const image = await seedNode({ type: 'image', x: 1100, y: ROW.y, data: { prompt: 'shoe' } });
    await open(page, session);

    const docAt = await centreOf(page, doc.id);
    await page.mouse.click(docAt.x, docAt.y);
    await expect(selected(page)).toHaveCount(1);
    await expect(page.locator(`[data-testid="gpu-dom-node"][data-id="${doc.id}"]`)).toBeVisible();
    await expect(page.getByRole('toolbar', { name: 'Selection actions' })).toBeVisible();

    const before = await row(admin, doc.id);
    const from = await centreOf(page, doc.id);
    const textBox = await boxOf(page, text.id);
    await page.mouse.move(from.x, from.y - 60);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y + 20, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await row(admin, doc.id)).x, { message: 'the drag is written to the node row' }).not.toBe(before.x);

    const imageAt = await boxOf(page, image.id);
    const surface = (await page.locator('[data-canvas-surface]').boundingBox())!;
    const inside = (p: { x: number; y: number }) => ({ x: Math.min(surface.x + surface.width - 4, Math.max(surface.x + 4, p.x)), y: Math.min(surface.y + surface.height - 4, Math.max(surface.y + 4, p.y)) });
    const corner = inside(await screen(page, { x: -150, y: ROW.y + Math.max(textBox.h, imageAt.h) + 150 }));
    const far = inside(await screen(page, { x: imageAt.x + imageAt.w + 150, y: ROW.y - 10 }));
    await page.mouse.move(corner.x, corner.y);
    await page.mouse.down();
    await page.mouse.move(far.x, far.y, { steps: 10 });
    await page.mouse.up();
    await expect(selected(page)).toHaveCount(3);

    await page.keyboard.press('Escape');
    const imageBox = await boxOf(page, image.id);
    const out = await screen(page, { x: textBox.x + textBox.w + 5, y: textBox.y + textBox.h / 2 });
    const into = await screen(page, { x: imageBox.x + imageBox.w / 2, y: imageBox.y + imageBox.h / 2 });
    await page.mouse.move(out.x, out.y);
    await page.mouse.down();
    await page.mouse.move(into.x, into.y, { steps: 12 });
    await page.mouse.up();
    await expect
      .poll(async () => (await admin.from('nodes_connections').select('id').eq('source_node_id', text.id).eq('target_node_id', image.id).is('deleted_at', null)).data?.length ?? 0, { message: 'a wire drawn port to node lands as a connection' })
      .toBe(1);

    const target = await centreOf(page, image.id);
    await page.mouse.click(target.x, target.y, { button: 'right' });
    await page.getByTestId('canvas-menu').getByRole('menuitem', { name: 'Delete' }).click();
    await expect.poll(async () => (await row(admin, image.id)).deleted_at).not.toBeNull();
  });

  test('ctrl+wheel zooms around the cursor, a plain wheel pans', async ({ page, session, seedNode }) => {
    await seedNode({ type: 'doc', x: 0, y: 0, data: { content: 'x', public: false } });
    await open(page, session);
    const start = await view(page);
    const host = (await page.locator('[data-canvas-surface]').boundingBox())!;
    await page.mouse.move(host.x + host.width / 2, host.y + host.height / 2);
    await page.mouse.wheel(0, 120);
    await expect.poll(async () => (await view(page)).y).not.toBe(start.y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -200);
    await page.keyboard.up('Control');
    await expect.poll(async () => (await view(page)).zoom).toBeGreaterThan(start.zoom);
  });

  test('a frame without a poster gets one shot off-screen, and a click opens the inline editor on it', async ({ page, session, admin, seedNode }) => {
    const frame = await seedNode({ type: 'motion', x: 80, y: 120, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    expect((await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId })).error).toBeNull();
    await open(page, session);

    await expect
      .poll(async () => ((await admin.from('nodes').select('data').eq('id', frame.id).single()).data?.data as { posterAssetId?: string | null }).posterAssetId ?? null, { timeout: 30_000, message: 'the shelf shoots the missing poster' })
      .not.toBeNull();
    await expect(page.getByTestId('gpu-poster-shelf')).toHaveCount(0);

    const at = await centreOf(page, frame.id);
    await page.mouse.click(at.x, at.y);
    await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mount', 'canvas', { timeout: 15_000 });
    await expect(page.locator(`[data-testid="gpu-dom-node"][data-id="${frame.id}"] [data-testid="motion-node-editing"]`)).toBeVisible();
  });

  test('the rectangle tool draws a free element on the GPU canvas, which opens and undoes like on the DOM one', async ({ page, session, admin }) => {
    const elements = async () => ((await admin.from('nodes').select('id, data, width, height').eq('canvas_id', session.canvasId).is('deleted_at', null)).data ?? []).filter((n) => (n.data as { kind?: string }).kind === 'element');
    await open(page, session);
    const bar = page.getByTestId('add-bar');
    await expect(bar).toHaveAttribute('data-context', 'canvas');
    await bar.getByTestId('draw-tools').locator('[data-tool="rectangle"]').click();
    await expect(page.getByTestId('canvas-draw')).toBeVisible();

    const pane = (await page.locator('[data-canvas-surface]').boundingBox())!;
    const from = { x: pane.x + pane.width * 0.35, y: pane.y + pane.height * 0.35 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 120, from.y + 60);
    await page.mouse.move(from.x + 240, from.y + 120);
    await page.mouse.up();

    await expect.poll(async () => (await elements()).length, { timeout: 10_000 }).toBe(1);
    const [element] = await elements();
    expect(element.width! / element.height!).toBeCloseTo(2, 1);
    await expect(page.getByTestId('canvas-draw'), 'one shape per pick, then back to select').toHaveCount(0);
    await expect(page.getByTestId('motion-editor'), 'the new element opens on its properties').toBeVisible({ timeout: 15_000 });

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(bar).toHaveAttribute('data-context', 'canvas', { timeout: 10_000 });
    await page.mouse.click(pane.x + 20, pane.y + pane.height - 120);
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await elements()).length, { timeout: 10_000 }).toBe(0);
  });
});
