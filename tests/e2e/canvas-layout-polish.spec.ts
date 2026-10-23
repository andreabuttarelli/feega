import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { SHOT_PREFIX } from './fixtures/shots';

const SETTLE_MS = 2500;
const AUTO_LAYOUT_DEFAULTS = { direction: 'horizontal', wrap: true, gap: 40, crossGap: 10, padding: { top: 0, right: 0, bottom: 0, left: 0 }, justify: 'start', align: 'start', columns: 2, order: [] };
const tile = (id: string, color: string) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', parent: 'wrap', props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.15, fills: [{ type: 'solid', color }] } });
const container = {
  id: 'wrap',
  from: 0,
  durationInFrames: 150,
  component: 'Shape',
  autoLayout: AUTO_LAYOUT_DEFAULTS,
  props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.7, height: 0.8, fills: [{ type: 'solid', color: '#e8e8e8' }], strokes: [{ paint: { type: 'solid', color: '#222222' }, width: 0.02, align: 'inside' }] }
};
const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [
    {
      id: 'v1',
      kind: 'visual',
      name: 'Video 1',
      clips: [container, tile('t1', '#ff5a1f'), tile('t2', '#1f5aff'), tile('t3', '#1fae5a'), tile('t4', '#f5c400'), tile('t5', '#a020f0')]
    }
  ],
  comps: {},
  assets: []
};

const overlapTile = (id: string, color: string) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', parent: 'row', props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.25, height: 0.4, fills: [{ type: 'solid', color }] } });
const row = { id: 'row', from: 0, durationInFrames: 150, component: 'Shape', autoLayout: { ...AUTO_LAYOUT_DEFAULTS, wrap: false, gap: -120, align: 'center', justify: 'center' }, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.9, height: 0.6, fills: [{ type: 'solid', color: '#e8e8e8' }] } };
const track = (clip: object, n: number) => ({ id: `t${n}`, kind: 'visual', name: `Video ${n}`, clips: [clip] });
const overlapDoc = { ...doc, tracks: [track(overlapTile('o3', '#1fae5a'), 1), track(overlapTile('o2', '#1f5aff'), 2), track(overlapTile('o1', '#ff5a1f'), 3), track({ ...row, autoLayout: { ...row.autoLayout, order: ['o1', 'o2', 'o3'] } }, 4)] };

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOT_PREFIX.replace(/shot$/, 'r7')}-${name}.png` });
}

test.describe('layout polish on the canvas @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  test('lines spread, the stacking and the stroke show in Properties and on the frame', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const frame = page.locator(`[data-frame="${node.id}"]`);
    await page.waitForTimeout(SETTLE_MS);
    const r = (await frame.boundingBox())!;
    const empty = { x: r.x + r.width * 0.5, y: r.y + r.height * 0.5 };
    await page.mouse.click(empty.x, empty.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(empty.x, empty.y);
    await expect(page.getByTestId('auto-layout-align-content')).toBeVisible({ timeout: 15_000 });
    await shot(page, 'polish-packed');

    await page.getByTestId('auto-layout-align-content').getByRole('radio', { name: 'Space between' }).click();
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, 'polish-space-between');

    await page.getByTestId('auto-layout-strokes-included').getByRole('radio', { name: 'No' }).click();
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, 'polish-strokes-off');

    await page.getByTestId('auto-layout-first-on-top').getByRole('radio', { name: 'Yes' }).click();
    await expect(page.getByTestId('auto-layout-first-on-top').getByRole('radio', { name: 'Yes' })).toBeChecked();
  });

  test('the first child draws on top once First on top is on', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: overlapDoc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const frame = page.locator(`[data-frame="${node.id}"]`);
    await page.waitForTimeout(SETTLE_MS);
    const r = (await frame.boundingBox())!;
    const empty = { x: r.x + r.width * 0.5, y: r.y + r.height * 0.5 };
    await page.mouse.click(r.x + r.width * 0.07, empty.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(r.x + r.width * 0.07, empty.y);
    await expect(page.getByTestId('auto-layout-first-on-top')).toBeVisible({ timeout: 15_000 });
    await shot(page, 'stacking-track-order');

    await page.getByTestId('auto-layout-first-on-top').getByRole('radio', { name: 'Yes' }).click();
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, 'stacking-first-on-top');
  });
});
