import type { Locator, Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { SHOT_PREFIX } from './fixtures/shots';
import { groupBox, groupHandleBoxes, handleBoxes, pickBox, pickCount } from './fixtures/canvas-marks';

const SHOTS = SHOT_PREFIX;
const SETTLE_MS = 2500;
const ROTATION = 20;
const ROTATE_OFFSET_PX = 6;
const HANDLES = 8;
const CORNER_BOTTOM_RIGHT = 2;
const BIG_NUDGES = 5;
const shape = (id: string, x: number, color: string) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x, y: 0.5, width: 0.2, height: 0.3, fills: [{ type: 'solid', color }] } });
const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [shape('a', 0.25, '#ff5a1f'), shape('b', 0.7, '#1f5aff')] }],
  comps: {},
  assets: []
};

type Point = { x: number; y: number };

async function shot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}-${name}.png` });
  }
}

const centreOfBox = (b: { x: number; y: number; width: number; height: number }): Point => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

const centre = async (l: Locator): Promise<Point> => {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

test.describe('Figma transforms on elements inside a core frame @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  for (const rotation of [0, ROTATION]) {
    test(`rotation ${rotation}`, async ({ page, session, admin, seedNode }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, rotation } });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();

      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      const frame = page.locator(`[data-frame="${node.id}"]`);
      await page.waitForTimeout(SETTLE_MS);

      const at = async (x: number): Promise<Point> => {
        const r = (await frame.boundingBox())!;
        const rad = (rotation * Math.PI) / 180;
        const [c, n] = [Math.cos(rad), Math.sin(rad)];
        const det = c * c - n * n;
        const w = (r.width * c - r.height * n) / det;
        const dx = (x - 0.5) * w;
        return { x: r.x + r.width / 2 + dx * c, y: r.y + r.height / 2 + dx * n };
      };

      const a = await at(0.25);
      await page.mouse.click(a.x, a.y);
      await page.waitForTimeout(SETTLE_MS);
      await page.mouse.click(a.x, a.y);
      await expect.poll(() => pickCount(page), { timeout: 15_000 }).toBe(1);
      await shot(page, `${rotation}-0-selected`);

      const start = centreOfBox((await pickBox(page))!);
      const towardB = await at(0.47);
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(towardB.x - (towardB.x - a.x) * 0.1, start.y + (towardB.y - a.y) * 0.9, { steps: 20 });
      await expect(page.getByTestId('frame-guide').first(), 'a smart guide shows while dragging').toBeAttached();
      await expect(page.getByTestId('frame-gap-label').first(), 'spacing to siblings shows').toBeVisible();
      await shot(page, `${rotation}-1-guides`);
      await page.mouse.up();
      await page.waitForTimeout(SETTLE_MS);
      await expect(page.getByTestId('frame-guide')).toHaveCount(0);

      const b = await at(0.7);
      await page.keyboard.down('Alt');
      await page.mouse.move(b.x, b.y, { steps: 5 });
      await expect(page.getByTestId('frame-measure-label').first(), 'Alt measures to the hovered element').toBeVisible({ timeout: 5000 });
      await shot(page, `${rotation}-2-measure`);
      await page.keyboard.up('Alt');

      const beforeNudge = (await pickBox(page))!;
      for (let i = 0; i < BIG_NUDGES; i++) {
        await page.keyboard.press('Shift+ArrowRight');
      }
      await page.waitForTimeout(SETTLE_MS);
      const afterNudge = (await pickBox(page))!;
      expect(Math.hypot(afterNudge.x - beforeNudge.x, afterNudge.y - beforeNudge.y), 'Shift+arrows nudge the element').toBeGreaterThan(5);

      const box = (await pickBox(page))!;
      const corner0 = (await handleBoxes(page))[CORNER_BOTTOM_RIGHT];
      const knob = { x: corner0.x + corner0.width / 2 + ROTATE_OFFSET_PX, y: corner0.y + corner0.height / 2 + ROTATE_OFFSET_PX };
      await page.mouse.move(knob.x, knob.y);
      await page.mouse.down();
      await page.mouse.move(knob.x - box.width / 2, knob.y + box.height / 2, { steps: 15 });
      await page.mouse.up();
      await page.waitForTimeout(SETTLE_MS);
      const turned = (await pickBox(page))!;
      expect(Math.abs(turned.width - box.width) + Math.abs(turned.height - box.height), 'rotating changes the outline').toBeGreaterThan(4);
      await shot(page, `${rotation}-3-rotated`);

      await page.keyboard.down('Shift');
      await page.mouse.click(b.x, b.y);
      await page.keyboard.up('Shift');
      await expect.poll(() => pickCount(page)).toBe(2);
      await expect.poll(async () => (await groupHandleBoxes(page)).length).toBe(HANDLES);
      const groupBefore = (await groupBox(page))!;
      const corner = centreOfBox((await groupHandleBoxes(page))[CORNER_BOTTOM_RIGHT]);
      await page.mouse.move(corner.x, corner.y);
      await page.mouse.down();
      await page.mouse.move(corner.x + 60, corner.y + 30, { steps: 15 });
      await page.mouse.up();
      await page.waitForTimeout(SETTLE_MS);
      const grown = (await groupBox(page))!;
      expect(grown.width * grown.height, 'the group resizes as one').toBeGreaterThan(groupBefore.width * groupBefore.height);
      await shot(page, `${rotation}-4-group-resized`);

      const flip = page.getByRole('button', { name: 'Flip horizontal' });
      if (await flip.count()) {
        await flip.first().click();
        await page.waitForTimeout(SETTLE_MS);
        await shot(page, `${rotation}-5-flipped`);
      }
    });
  }
});
