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
const AUTO_LAYOUT = { direction: 'horizontal', wrap: false, gap: 0, crossGap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, justify: 'start', align: 'start', columns: 2, order: [] };
const box = { id: 'box', from: 0, durationInFrames: 150, component: 'Shape', autoLayout: AUTO_LAYOUT, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.8, height: 0.5, fills: [{ type: 'solid', color: '#e8e8e8' }] } };
const kid = { id: 'kid', from: 0, durationInFrames: 150, component: 'Shape', parent: 'box', props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.2, fills: [{ type: 'solid', color: '#1f5aff' }] } };
const paddedDoc = { version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, background: 'brand', tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [box, kid] }], comps: {}, assets: [] };

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOT_PREFIX.replace(/shot$/, 'r7')}-${name}.png` });
}

test.describe('stack and padding shorthand @real', () => {
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

  test('padding takes CSS shorthand', async ({ page, session, admin, seedNode }) => {
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
    const padding = page.getByTestId('auto-layout-padding');
    await expect(padding).toBeVisible({ timeout: 15_000 });
    await padding.fill('8, 16');
    await padding.dispatchEvent('change');

    await expect(page.getByTestId('auto-layout-padding-top')).toHaveValue('8');
    await expect(page.getByTestId('auto-layout-padding-right')).toHaveValue('16');
    await expect(page.getByTestId('auto-layout-padding-bottom')).toHaveValue('8');
    await expect(page.getByTestId('auto-layout-padding-left')).toHaveValue('16');
    await shot(page, 'padding-shorthand');
  });
});
