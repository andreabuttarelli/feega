import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { SHOT_PREFIX } from './fixtures/shots';

const SHOTS = SHOT_PREFIX;
const SETTLE_MS = 2500;
const AUTO_LAYOUT_DEFAULTS = { wrap: false, crossGap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, align: 'center', columns: 2, order: [] };
const square = (id: string, parent: string, color: string) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', parent, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.1, height: 0.15, fills: [{ type: 'solid', color }] } });
const row = (id: string, y: number, autoLayout: object) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', autoLayout: { ...AUTO_LAYOUT_DEFAULTS, ...autoLayout }, props: { shape: 'rect', x: 0.5, y, width: 0.9, height: 0.25, fills: [{ type: 'solid', color: '#e8e8e8' }] } });
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
      clips: [
        row('evenly', 0.3, { direction: 'horizontal', gap: 0, justify: 'space-evenly' }),
        square('e1', 'evenly', '#ff5a1f'),
        square('e2', 'evenly', '#1f5aff'),
        square('e3', 'evenly', '#1fae5a'),
        row('overlap', 0.7, { direction: 'horizontal', gap: -60, justify: 'center' }),
        square('o1', 'overlap', '#ff5a1f'),
        square('o2', 'overlap', '#1f5aff'),
        square('o3', 'overlap', '#1fae5a')
      ]
    }
  ],
  comps: {},
  assets: []
};

async function shot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}-${name}.png` });
  }
}

test.describe('auto layout spacing on the canvas @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  test('space-evenly and a negative gap draw and show in Properties', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const frame = page.locator(`[data-frame="${node.id}"]`);
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, 'drawn');

    const r = (await frame.boundingBox())!;
    const empty = { x: r.x + r.width * 0.12, y: r.y + r.height * 0.3 };
    await page.mouse.click(empty.x, empty.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(empty.x, empty.y);
    await expect(page.getByTestId('auto-layout-space-evenly')).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
    await shot(page, 'evenly-selected');
  });
});
