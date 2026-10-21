import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated, type E2eSession } from './fixtures/session';

const SHOTS = process.env.CANVAS_FREE_SHOTS;
const DRAG = { width: 200, height: 120 };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };

const FRAME_DOC = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'base', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.25, y: 0.3, width: 0.2, height: 0.2, fills: [{ type: 'solid', color: '#ff5a1f' }] } }] }],
  comps: {},
  assets: []
};

type Placed = { id: string; kind: string | null };

async function nodesOf(admin: SupabaseClient, session: E2eSession): Promise<Placed[]> {
  const { data } = await admin.from('nodes').select('id, type, data').eq('canvas_id', session.canvasId).is('deleted_at', null);
  return (data ?? []).filter((n) => n.type === 'motion').map((n) => ({ id: n.id, kind: (n.data as { kind?: string }).kind ?? 'frame' }));
}

async function drawAt(page: Page, tool: string, share: { x: number; y: number }) {
  await pickBarTool(page, tool);
  await expect(page.getByTestId('canvas-draw')).toBeVisible();
  const pane = (await page.locator('.svelte-flow').boundingBox())!;
  const from = { x: pane.x + pane.width * share.x, y: pane.y + pane.height * share.y };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + DRAG.width / 2, from.y + DRAG.height / 2);
  await page.mouse.move(from.x + DRAG.width, from.y + DRAG.height);
  await page.mouse.up();
}

async function leaveEditor(page: Page) {
  await page.keyboard.press('Escape');
  const pane = (await page.locator('.svelte-flow').boundingBox())!;
  await page.mouse.click(pane.x + 20, pane.y + pane.height - 120);
  await expect(page.getByTestId('add-bar')).toHaveAttribute('data-context', 'canvas');
}

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/free-${name}.png` });
  }
}

test.describe('free insertion from the bottom bar @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('box, text and circle on the bare canvas are free elements and stay free after a reload', async ({ page, session, admin }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const url = `/p/${session.projectId}/c/${session.canvasId}`;
    await gotoHydrated(page, url);

    const tools = [
      { tool: 'rectangle', at: { x: 0.15, y: 0.15 } },
      { tool: 'ellipse', at: { x: 0.45, y: 0.15 } },
      { tool: 'text', at: { x: 0.7, y: 0.15 } }
    ];
    for (const [i, { tool, at }] of tools.entries()) {
      await drawAt(page, tool, at);
      await expect.poll(async () => (await nodesOf(admin, session)).length, { timeout: 15_000 }).toBe(i + 1);
      await leaveEditor(page);
      await shoot(page, `${tool}-drawn`);
    }

    expect((await nodesOf(admin, session)).map((n) => n.kind)).toEqual(['element', 'element', 'element']);
    await gotoHydrated(page, url);
    await expect(page.locator('[data-motion-node]')).toHaveCount(3, { timeout: 20_000 });
    await expect(page.locator('.node-label')).toHaveCount(0);
    await page.waitForTimeout(1500);
    await shoot(page, 'after-reload');
    expect((await nodesOf(admin, session)).map((n) => n.kind)).toEqual(['element', 'element', 'element']);
  });

  test('a box drawn inside a frame becomes a clip of that frame and no free element appears', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: FRAME_DOC, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    const url = `/p/${session.projectId}/c/${session.canvasId}`;
    const clipCount = async () => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
      return (data?.[0]?.doc as { tracks: { clips: unknown[] }[] }).tracks.flatMap((t) => t.clips).length;
    };

    await gotoHydrated(page, url);
    const stage = page.locator(`[data-motion-node="${frame.id}"] [data-frame-stage]`);
    await expect(stage).toBeVisible({ timeout: 20_000 });
    const box = (await stage.boundingBox())!;

    await pickBarTool(page, 'rectangle');
    await expect(page.getByTestId('canvas-draw')).toBeVisible();
    const from = { x: box.x + box.width * 0.55, y: box.y + box.height * 0.55 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y + 20);
    await page.mouse.move(from.x + 80, from.y + 40);
    await page.mouse.up();

    await expect.poll(clipCount, { timeout: 20_000, message: 'the box is a clip of the frame' }).toBe(2);
    await expect.poll(async () => (await nodesOf(admin, session)).map((n) => n.kind), { timeout: 20_000, message: 'no free element is left behind' }).toEqual(['frame']);
    await shoot(page, 'into-frame');

    await gotoHydrated(page, url);
    await expect(stage).toBeVisible({ timeout: 20_000 });
    await shoot(page, 'into-frame-after-reload');
    expect(await clipCount()).toBe(2);
    expect((await nodesOf(admin, session)).map((n) => n.kind)).toEqual(['frame']);
  });

  test('a free element is selected as an element: no timeline, shape icon in the tree, and a real frame keeps its timeline', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const frame = await seedNode({ type: 'motion', x: 80, y: 480, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: FRAME_DOC, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);

    for (const [i, { tool, at }] of [{ tool: 'rectangle', at: { x: 0.15, y: 0.15 } }, { tool: 'ellipse', at: { x: 0.45, y: 0.15 } }, { tool: 'text', at: { x: 0.7, y: 0.15 } }].entries()) {
      await drawAt(page, tool, at);
      await expect.poll(async () => (await nodesOf(admin, session)).filter((n) => n.kind === 'element').length, { timeout: 15_000 }).toBe(i + 1);
      await page.keyboard.press('Escape');
      const pane = (await page.locator('.svelte-flow').boundingBox())!;
      await page.mouse.click(pane.x + 20, pane.y + pane.height - 120);
      await expect(page.getByTestId('add-bar')).toHaveAttribute('data-context', 'canvas');
    }

    const elements = (await nodesOf(admin, session)).filter((n) => n.kind === 'element');
    for (const element of elements) {
      await page.locator(`[data-motion-node="${element.id}"]`).click({ force: true });
      await expect(page.getByTestId('frame-timeline')).toHaveCount(0);
      await expect(page.getByTestId('side-tab-properties')).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 });
      await expect(page.getByText('Layout', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      await shoot(page, `element-${element.id.slice(0, 4)}-selected`);
    }

    await page.locator(`[data-motion-node="${elements[0].id}"]`).click({ force: true });
    const alpha = page.getByTestId('fill-opacity').first();
    await expect(alpha).toBeVisible({ timeout: 15_000 });
    await alpha.fill('40');
    await alpha.blur();
    await expect(alpha).toHaveValue('40');
    await shoot(page, 'element-fill-edited');

    await page.getByRole('button', { name: 'Layers' }).click();
    await page.waitForTimeout(800);
    await shoot(page, 'element-layers-tree');
    const icons = await page.locator('[data-layer] .icon svg').evaluateAll((svgs) => svgs.map((svg) => svg.getAttribute('class') ?? ''));
    expect(new Set(icons).size).toBeGreaterThan(2);

    await page.locator(`[data-motion-node="${frame.id}"] [data-frame-stage]`).click({ force: true });
    await expect(page.getByTestId('frame-timeline')).toBeVisible({ timeout: 15_000 });
    await shoot(page, 'frame-selected-timeline');
  });
});
