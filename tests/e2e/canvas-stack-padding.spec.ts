import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { SHOT_PREFIX } from './fixtures/shots';

const SETTLE_MS = 2500;
const ELEMENT = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, kind: 'element' };
const sheet = (color: string) => ({
  version: 5,
  fps: 30,
  width: 200,
  height: 200,
  durationInFrames: 150,
  background: 'transparent',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 's', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, fills: [{ type: 'solid', color }] } }] }]
});
const textSheet = {
  version: 5,
  fps: 30,
  width: 240,
  height: 80,
  durationInFrames: 150,
  background: 'transparent',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 't', from: 0, durationInFrames: 150, component: 'Text', props: { text: 'Launch day', x: 0.5, y: 0.5, width: 1, height: 1, color: '#111111' } }] }]
};
const AUTO_LAYOUT = { direction: 'horizontal', wrap: false, gap: 0, crossGap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, justify: 'start', align: 'start', columns: 2, order: [] };
const box = { id: 'box', from: 0, durationInFrames: 150, component: 'Shape', autoLayout: AUTO_LAYOUT, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.8, height: 0.5, fills: [{ type: 'solid', color: '#e8e8e8' }] } };
const kid = { id: 'kid', from: 0, durationInFrames: 150, component: 'Shape', parent: 'box', props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.2, fills: [{ type: 'solid', color: '#1f5aff' }] } };
const paddedDoc = { version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, background: 'brand', tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [box, kid] }], comps: {}, assets: [] };

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOT_PREFIX.replace(/shot$/, 'r7')}-${name}.png` });
}

test.describe('stack and padding @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  test('Shift+A wraps three free elements in one free Stack', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const ids: string[] = [];
    for (const [i, color] of ['#ff5a1f', '#1f5aff', '#1fae5a'].entries()) {
      const node = await seedNode({ type: 'motion', x: i * 300, y: i % 2 === 0 ? 0 : 140, data: ELEMENT });
      await admin.from('nodes').update({ width: 120, height: 120 }).eq('id', node.id);
      await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: sheet(color), actor_kind: 'user', actor_id: session.userId });
      ids.push(node.id);
    }
    const live = async () => (await admin.from('nodes').select('id, display_name').eq('canvas_id', session.canvasId).is('deleted_at', null)).data ?? [];

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, 'stack-before');
    await page.locator('.svelte-flow__pane').click({ position: { x: 10, y: 10 } });
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Shift+A');

    await expect.poll(async () => (await live()).map((n) => n.display_name), { timeout: 10_000 }).toEqual(['Stack']);
    expect((await live()).some((n) => ids.includes(n.id))).toBe(false);
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, 'stack-after');
  });

  test('Wrap with stack on one free text makes a new Stack holding it, and Layers nests the text', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 200, y: 200, data: ELEMENT });
    await admin.from('nodes').update({ width: 240, height: 80, display_name: 'Text' }).eq('id', node.id);
    await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: textSheet, actor_kind: 'user', actor_id: session.userId });
    const live = async () => (await admin.from('nodes').select('id, display_name').eq('canvas_id', session.canvasId).is('deleted_at', null)).data ?? [];

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);
    const tile = (await page.locator(`[data-frame="${node.id}"]`).boundingBox())!;
    await page.mouse.click(tile.x + tile.width / 2, tile.y + tile.height / 2);
    await page.getByTestId('more-actions').click();
    await page.locator('[data-action="wrap-stack"]').click();

    await expect.poll(async () => (await live()).map((n) => n.display_name), { timeout: 10_000 }).toEqual(['Stack']);
    const [stack] = await live();
    const { data: head } = await admin.from('motion_revisions').select('doc').eq('node_id', stack.id).order('version', { ascending: false }).limit(1).single();
    const clips = (head!.doc as typeof textSheet).tracks.flatMap((t) => t.clips) as { id: string; component: string; parent?: string; autoLayout?: unknown }[];
    const root = clips.find((c) => !c.parent)!;
    expect(root.autoLayout).toBeTruthy();
    expect(clips.find((c) => c.id === 't')).toMatchObject({ component: 'Text', parent: root.id });

    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const layers = page.getByTestId('layers');
    await expect(layers.locator(`[data-layer="${stack.id}"]`)).toContainText('Stack');
    await expect(layers.locator('[data-layer="t"]')).toContainText('Text');
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, 'stack-one-text');
  });

  test('padding sets horizontal and vertical, then splits per side', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: paddedDoc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const frame = page.locator(`[data-frame="${node.id}"]`);
    await page.waitForTimeout(SETTLE_MS);
    const r = (await frame.boundingBox())!;
    const at = { x: r.x + r.width * 0.5, y: r.y + r.height * 0.5 };
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(at.x, at.y);
    const chip = (id: string) => page.getByTestId(id).locator('input');
    const type = async (id: string, value: string) => {
      await chip(id).fill(value);
      await chip(id).press('Enter');
    };
    await expect(chip('auto-layout-padding-x')).toBeVisible({ timeout: 15_000 });
    await type('auto-layout-padding-x', '16');
    await type('auto-layout-padding-y', '8');
    await page.getByTestId('auto-layout-padding-sides').click();

    await expect(chip('auto-layout-padding-top')).toHaveValue('8');
    await expect(chip('auto-layout-padding-right')).toHaveValue('16');
    await expect(chip('auto-layout-padding-bottom')).toHaveValue('8');
    await expect(chip('auto-layout-padding-left')).toHaveValue('16');

    await type('auto-layout-padding-left', '24');
    await page.getByTestId('auto-layout-padding-sides').click();
    await expect(page.getByTestId('auto-layout-padding')).toHaveAttribute('data-view', 'axes');
    await expect(chip('auto-layout-padding-x')).toHaveValue('24');
    await expect(chip('auto-layout-padding-y')).toHaveValue('8');
    await shot(page, 'padding-axes');
  });

  test('min and max take px or % from the W mode menu and show as chips', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: paddedDoc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const r = (await page.locator(`[data-frame="${node.id}"]`).boundingBox())!;
    const at = { x: r.x + r.width * 0.5, y: r.y + r.height * 0.5 };
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(at.x, at.y);

    await page.getByTestId('stack-unit-width').click({ timeout: 15_000 });
    const min = page.getByTestId('stack-limit-input-min-width');
    await min.fill('200px');
    await min.press('Enter');
    const max = page.getByTestId('stack-limit-input-max-width');
    await max.fill('50%');
    await max.press('Enter');
    await page.getByTestId('stack-unit-width').click();

    await expect(page.getByTestId('stack-limit-min-width')).toContainText('200px', { timeout: 15_000 });
    await expect(page.getByTestId('stack-limit-max-width')).toContainText('50%');
    await page.getByTestId('stack-limit-clear-min-width').click();
    await expect(page.getByTestId('stack-limit-min-width')).toHaveCount(0);
    await shot(page, 'limits');
  });
});
