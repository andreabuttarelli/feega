import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const PHONE = { width: 390, height: 844 };
const DRAG_PX = 80;
const SETTLE_MS = 1_200;
const START = { x: 40, y: 140 };

const landscape = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };

const nodeOf = (page: Page, id: string) => page.locator(`.svelte-flow__node[data-id="${id}"]`);
const phone = () => !!test.info().project.use.hasTouch;
const viewportTransform = (page: Page) => page.locator('.svelte-flow__viewport').evaluate((v) => getComputedStyle(v).transform);

async function seedFrame({ session, admin, seedNode }: { session: { orgId: string; userId: string }; admin: import('@supabase/supabase-js').SupabaseClient; seedNode: (s: { type: string; x: number; y: number; data: Record<string, unknown> }) => Promise<{ id: string }> }) {
  const frame = await seedNode({ type: 'motion', ...START, data: landscape });
  const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
  expect(error).toBeNull();
  return frame;
}

async function select(page: Page, id: string) {
  const box = (await nodeOf(page, id).boundingBox())!;
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  if (phone()) {
    await page.touchscreen.tap(at.x, at.y);
  } else {
    await page.mouse.click(at.x, at.y);
  }
  await expect(page.locator(`.svelte-flow__node[data-id="${id}"]:is(.selected, [aria-pressed="true"])`)).toHaveCount(1);
}

test.describe('a frame on the canvas: select, move, open @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    if (phone()) {
      await page.setViewportSize(PHONE);
    }
  });

  test('no frame tile shows Open editor', async ({ page, session, admin, seedNode }) => {
    const frame = await seedFrame({ session, admin, seedNode });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(nodeOf(page, frame.id)).toBeVisible();
    await select(page, frame.id);
    await page.waitForTimeout(SETTLE_MS);
    await expect(page.getByTestId('open-motion-editor')).toHaveCount(0);
    await expect(page.locator('.svelte-flow').getByText('Open editor')).toHaveCount(0);
  });

  test('a selected frame drags to a new place, without editing, and stays there after a reload', async ({ page, session, admin, seedNode }) => {
    const frame = await seedFrame({ session, admin, seedNode });
    const anchor = await seedNode({ type: 'text', x: START.x, y: START.y + 400, data: { text: 'anchor' } });
    const offset = async () => (await nodeOf(page, frame.id).boundingBox())!.x - (await nodeOf(page, anchor.id).boundingBox())!.x;
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await select(page, frame.id);
    await page.waitForTimeout(SETTLE_MS);
    const offsetBefore = await offset();

    const body = nodeOf(page, frame.id).getByTestId('motion-node-stage');
    const before = (await body.boundingBox())!;
    const from = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + DRAG_PX / 2, from.y, { steps: 5 });
    await page.mouse.move(from.x + DRAG_PX, from.y, { steps: 5 });
    await page.mouse.up();

    await expect.poll(async () => (await body.boundingBox())!.x - before.x, { message: 'the frame follows the pointer' }).toBeGreaterThan(DRAG_PX / 2);
    await expect(page.getByTestId('selection-box'), 'no inner element was picked').toHaveCount(0);
    await expect.poll(async () => ((await admin.from('nodes').select('x').eq('id', frame.id).single()).data?.x as number) ?? START.x, { timeout: 10_000, message: 'the move is saved' }).toBeGreaterThan(START.x + 10);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(nodeOf(page, anchor.id)).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => (await offset()) - offsetBefore, { message: 'still moved after a reload' }).toBeGreaterThan(DRAG_PX / 2);
  });

  test('double-click opens the editor and the canvas view does not move', async ({ page, session, admin, seedNode }) => {
    const frame = await seedFrame({ session, admin, seedNode });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await select(page, frame.id);
    await page.waitForTimeout(SETTLE_MS);
    const before = await viewportTransform(page);

    const box = (await nodeOf(page, frame.id).getByTestId('motion-node-stage').boundingBox())!;
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mount', 'canvas', { timeout: 20_000 });
    await page.waitForTimeout(SETTLE_MS);
    expect(await viewportTransform(page), 'the view stays where it was').toBe(before);
  });
});
