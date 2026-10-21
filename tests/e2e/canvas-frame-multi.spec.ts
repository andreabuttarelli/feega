import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.SHOT_PREFIX ?? '';
const SETTLE_MS = 2500;
const SIZE_TOLERANCE_PX = 2;
const ROTATION = 20;
const shape = (id: string, x: number, color: string) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x, y: 0.5, width: 0.2, height: 0.3, fills: [{ type: 'solid', color }] } });
const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [shape('a', 0.25, '#ff5a1f'), shape('b', 0.6, '#1f5aff')] }],
  comps: {},
  assets: []
};

async function shot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}-${name}.png` });
  }
}

test.describe('multi-select, undo and rotated chrome inside a core frame @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  for (const rotation of [0, ROTATION]) {
    test(`rotation ${rotation}`, async ({ page, session, admin, seedNode }) => {
      test.setTimeout(150_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, rotation } });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();

      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      const frame = page.locator(`[data-frame="${node.id}"]`);
      await page.waitForTimeout(SETTLE_MS);

      const at = async (x: number) => {
        const r = (await frame.boundingBox())!;
        return { x: r.x + r.width * x, y: r.y + r.height * 0.5 };
      };
      const first = await at(0.25);
      await page.mouse.click(first.x, first.y);
      await page.waitForTimeout(SETTLE_MS);
      await page.mouse.click(first.x, first.y);
      await expect(page.getByTestId('frame-selection')).toHaveCount(1, { timeout: 15_000 });
      const size = (await frame.boundingBox())!;
      await shot(page, `${rotation}-one`);

      const second = await at(0.6);
      await page.keyboard.down('Shift');
      await page.mouse.click(second.x, second.y);
      await page.keyboard.up('Shift');
      await expect(page.getByTestId('frame-selection')).toHaveCount(2);
      const multi = (await frame.boundingBox())!;
      expect(Math.abs(multi.width - size.width)).toBeLessThan(SIZE_TOLERANCE_PX);
      expect(Math.abs(multi.height - size.height)).toBeLessThan(SIZE_TOLERANCE_PX);
      await shot(page, `${rotation}-multi`);

      const body = page.getByTestId('frame-selection-body').first();
      const b = (await body.boundingBox())!;
      const start = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x + 60, start.y + 20, { steps: 15 });
      await page.mouse.up();
      await page.waitForTimeout(SETTLE_MS);
      const moved = (await body.boundingBox())!;
      expect(Math.abs(moved.x - b.x)).toBeGreaterThan(SIZE_TOLERANCE_PX);
      await shot(page, `${rotation}-moved`);

      await page.keyboard.press('Control+z');
      await page.waitForTimeout(SETTLE_MS);
      const undone = (await body.boundingBox())!;
      expect(Math.abs(undone.x - b.x)).toBeLessThan(SIZE_TOLERANCE_PX);
      await shot(page, `${rotation}-undone`);

      await page.keyboard.press('Control+Shift+z');
      await page.waitForTimeout(SETTLE_MS);
      const redone = (await body.boundingBox())!;
      expect(Math.abs(redone.x - moved.x)).toBeLessThan(SIZE_TOLERANCE_PX);
      const after = (await frame.boundingBox())!;
      expect(Math.abs(after.width - size.width)).toBeLessThan(SIZE_TOLERANCE_PX);
      await shot(page, `${rotation}-redone`);
    });
  }
});
