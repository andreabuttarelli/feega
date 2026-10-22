import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.SHOT_PREFIX ?? '';
const SETTLE_MS = 2500;
const hugged = { width: 'hug', height: 'hug', absolute: false, columnSpan: 1, rowSpan: 1 };
const text = (id: string, words: string, size: number) => ({ id, from: 0, durationInFrames: 150, component: 'Text', parent: 'row', layoutItem: hugged, props: { text: words, size, leading: 1.1, x: 0.5, y: 0.5, width: 0.3, height: 0.1, color: '#111111' } });
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
        { id: 'row', from: 0, durationInFrames: 150, component: 'Shape', autoLayout: { direction: 'horizontal', wrap: false, gap: 40, crossGap: 0, padding: { top: 40, right: 40, bottom: 40, left: 40 }, justify: 'start', align: 'baseline', columns: 2, order: [] }, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.9, height: 0.5, fills: [{ type: 'solid', color: '#e8e8e8' }] } },
        text('big', 'Big', 0.12),
        text('small', 'small', 0.04),
        { id: 'dot', from: 0, durationInFrames: 150, component: 'Shape', parent: 'row', props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.04, height: 0.04, fills: [{ type: 'solid', color: '#ff5a1f' }] } }
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

test.describe('baseline alignment on the canvas @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  test('texts of different sizes share a baseline and Properties marks it', async ({ page, session, admin, seedNode }) => {
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
    const edge = { x: r.x + r.width * 0.07, y: r.y + r.height * 0.27 };
    await page.mouse.click(edge.x, edge.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(edge.x, edge.y);
    await expect(page.getByTestId('auto-layout-baseline')).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
    await shot(page, 'selected');
  });
});
