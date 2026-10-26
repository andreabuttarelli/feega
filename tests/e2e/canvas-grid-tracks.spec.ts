import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.SHOT_PREFIX ?? '';
const SETTLE_MS = 2500;
const solid = (color: string) => [{ type: 'solid', color }];
const kid = (id: string, color: string, layoutItem: object = {}) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', parent: 'grid', layoutItem: { width: 'fixed', height: 'fixed', absolute: false, columnSpan: 1, rowSpan: 1, ...layoutItem }, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.08, height: 0.12, fills: solid(color) } });
const grid = {
  id: 'grid',
  from: 0,
  durationInFrames: 150,
  component: 'Shape',
  autoLayout: { direction: 'grid', wrap: false, gap: 20, crossGap: 20, padding: { top: 20, right: 20, bottom: 20, left: 20 }, justify: 'start', align: 'start', columns: 3, order: [], autoFlow: 'row', columnTracks: [{ type: 'fixed', value: 300 }, { type: 'flex', value: 1 }, { type: 'hug', value: 0 }], rowTracks: [{ type: 'hug', value: 0 }, { type: 'flex', value: 1 }] },
  props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.9, height: 0.8, fills: solid('#e8e8e8') }
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
      clips: [
        grid,
        kid('wide', '#ff5a1f', { width: 'fill', height: 'fill', columnSpan: 2 }),
        kid('hugged', '#1f5aff'),
        kid('tall', '#1fae5a', { width: 'fill', height: 'fill' }),
        kid('corner', '#aa22cc', { cellX: 'end', cellY: 'end' }),
        kid('last', '#222222', { cellX: 'center', cellY: 'center' })
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

test.describe('grid tracks on the canvas @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  test('fixed, flex and hug tracks, spans and cell alignment draw and show in Properties', async ({ page, session, admin, seedNode }) => {
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
    const edge = { x: r.x + r.width * 0.06, y: r.y + r.height * 0.11 };
    await page.mouse.click(edge.x, edge.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(edge.x, edge.y);
    await expect(page.getByTestId('auto-layout-column-tracks')).toHaveValue('300 1fr hug', { timeout: 15_000 });
    await shot(page, 'grid-selected');
  });
});
