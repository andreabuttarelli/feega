import sharp from 'sharp';
import type { Locator, Page } from '@playwright/test';
import { pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };

const SHOTS = `${process.env.HOME}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2500;
const STEPS = 6;
const FRAME_MS = 100;
const TOLERANCE_PX = 4;
const UNDER_CHROME_PX = 8;
const SHAPE_RGB: [number, number, number] = [0, 153, 255];
const COLOUR_SLACK = 14;
const TURNED = 30;
const FRAME_TURN = 20;
const CORNER_BOTTOM_RIGHT = 2;
const CORNER_TOP_LEFT = 0;
const OUTSIDE_PX = 10;
const DRAG: Point = { x: 90, y: 60 };
const PULL = 60;

const centre = (r: Rect): Point => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const along = (p: Point, deg: number) => p.x * Math.cos((deg * Math.PI) / 180) + p.y * Math.sin((deg * Math.PI) / 180);

async function shapeBounds(page: Page, near: Rect): Promise<Rect> {
  const { data, info } = await sharp(await page.screenshot()).raw().toBuffer({ resolveWithObject: true });
  let [l, t, r, b] = [Infinity, Infinity, -1, -1];
  for (let y = Math.max(0, Math.floor(near.y)); y < Math.min(info.height, near.y + near.height); y++) {
    for (let x = Math.max(0, Math.floor(near.x)); x < Math.min(info.width, near.x + near.width); x++) {
      const i = (y * info.width + x) * info.channels;
      if (SHAPE_RGB.every((c, k) => Math.abs(data[i + k] - c) < COLOUR_SLACK)) {
        [l, t, r, b] = [Math.min(l, x), Math.min(t, y), Math.max(r, x), Math.max(b, y)];
      }
    }
  }
  return { x: l, y: t, width: r - l + 1, height: b - t + 1 };
}

function expectRect(actual: Rect, expected: Rect, what: string) {
  for (const k of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(actual[k] - expected[k]), `${what} ${k}: ${actual[k]} vs ${expected[k]}`).toBeLessThan(TOLERANCE_PX);
  }
}

async function drawBox(page: Page): Promise<void> {
  await pickBarTool(page, 'rectangle');
  const pane = (await page.getByTestId('core-canvas').boundingBox())!;
  const from = { x: pane.x + pane.width * 0.3, y: pane.y + pane.height * 0.3 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 160, from.y + 100, { steps: 3 });
  await page.mouse.up();
  await expect(page.getByTestId('frame-selection')).toHaveCount(1, { timeout: 15_000 });
  await page.waitForTimeout(SETTLE_MS);
}

async function outerEdge(page: Page, deg: number): Promise<{ edge: Locator; opposite: Locator }> {
  const edges = page.getByTestId('frame-selection-edge');
  const reach = await Promise.all((await edges.all()).map(async (e) => along(centre((await e.boundingBox())!), deg)));
  const order = reach.map((r, i) => [r, i]).sort((a, b) => a[0] - b[0]);
  return { edge: edges.nth(order[order.length - 1][1]), opposite: edges.nth(order[0][1]) };
}

async function pullEdge(page: Page, deg: number, shot: string) {
  const { edge, opposite } = await outerEdge(page, deg);
  const start = centre((await edge.boundingBox())!);
  const still = centre((await opposite.boundingBox())!);
  const rad = (deg * Math.PI) / 180;
  const to = { x: start.x + PULL * Math.cos(rad), y: start.y + PULL * Math.sin(rad) };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: STEPS });
  await page.screenshot({ path: `${SHOTS}/resize-${shot}.png` });
  const moved = centre((await edge.boundingBox())!);
  const kept = centre((await opposite.boundingBox())!);
  await page.mouse.up();
  expect(Math.hypot(kept.x - still.x, kept.y - still.y), 'the opposite side stays put').toBeLessThan(TOLERANCE_PX);
  expect(Math.hypot(moved.x - to.x, moved.y - to.y), 'the dragged side follows the pointer').toBeLessThan(TOLERANCE_PX);
}

test.describe('resize is live and handle-true on the GPU canvas @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  test('a free box: corner drag draws the shape and the selection where the pointer says, side drag resizes one side', async ({ page, session }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1200, height: 800 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await drawBox(page);

    const selection = page.getByTestId('frame-selection');
    const before = (await selection.boundingBox())!;
    const corner = { x: before.x + before.width, y: before.y + before.height };
    await page.mouse.move(corner.x, corner.y);
    await page.mouse.down();
    await page.mouse.move(corner.x + DRAG.x, corner.y + DRAG.y, { steps: STEPS });
    const expected = { x: before.x, y: before.y, width: before.width + DRAG.x, height: before.height + DRAG.y };
    const INSET = 6;
    const near = { x: before.x + INSET, y: before.y + INSET, width: expected.width + 40, height: expected.height + 40 };
    await page.waitForTimeout(FRAME_MS);
    await page.screenshot({ path: `${SHOTS}/resize-free-corner.png` });
    const shape = await shapeBounds(page, near);
    expectRect((await selection.boundingBox())!, expected, 'selection mid-drag');
    expect(Math.abs(shape.x + shape.width - (expected.x + expected.width)), 'shape right edge mid-drag').toBeLessThan(UNDER_CHROME_PX);
    expect(Math.abs(shape.y + shape.height - (expected.y + expected.height)), 'shape bottom edge mid-drag').toBeLessThan(UNDER_CHROME_PX);
    await page.mouse.up();
    await page.waitForTimeout(SETTLE_MS);
    expectRect((await selection.boundingBox())!, expected, 'selection after release');

    await pullEdge(page, 0, 'free-edge');
  });

  test('a turned free box resizes one side along its own axis', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1200, height: 800 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await drawBox(page);
    const middle = centre((await page.getByTestId('frame-selection').boundingBox())!);
    const corner = centre((await page.getByTestId('frame-selection-handle').nth(CORNER_BOTTOM_RIGHT).boundingBox())!);
    const grip = { x: corner.x + OUTSIDE_PX, y: corner.y + OUTSIDE_PX };
    const radius = Math.hypot(grip.x - middle.x, grip.y - middle.y);
    const start = Math.atan2(grip.y - middle.y, grip.x - middle.x);
    await page.mouse.move(grip.x, grip.y);
    await page.mouse.down();
    for (let step = 1; step <= STEPS; step++) {
      const angle = start + (TURNED * Math.PI * step) / (180 * STEPS);
      await page.mouse.move(middle.x + radius * Math.cos(angle), middle.y + radius * Math.sin(angle));
    }
    await page.mouse.up();
    let turned = 0;
    await expect
      .poll(async () => {
        const { data } = await admin.from('nodes').select('data').eq('canvas_id', session.canvasId).is('deleted_at', null);
        turned = Number((data ?? []).map((n) => (n.data as { rotation?: number }).rotation ?? 0).find((r) => r) ?? 0);
        return Math.round(turned);
      }, { timeout: 10_000 })
      .toBeGreaterThan(TURNED - 5);
    await page.waitForTimeout(SETTLE_MS);
    await pullEdge(page, turned, 'free-turned-edge');
  });

  for (const rotation of [0, FRAME_TURN]) {
    test(`an element in a frame turned ${rotation}: the corner opposite stays, the side drag resizes one side`, async ({ page, session, admin, seedNode }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      const clip = { id: 'a', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.3, y: 0.5, width: 0.2, height: 0.3, fills: [{ type: 'solid', color: '#ff5a1f' }] } };
      const doc = { version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, background: 'brand', tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [clip] }], comps: {}, assets: [] };
      const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, rotation } });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await page.waitForTimeout(SETTLE_MS);
      const shown = (await page.locator(`[data-frame="${node.id}"]`).boundingBox())!;
      const rad = (rotation * Math.PI) / 180;
      const [c, s] = [Math.cos(rad), Math.sin(rad)];
      const w = (shown.width * c - shown.height * s) / (c * c - s * s);
      const at = { x: shown.x + shown.width / 2 - 0.2 * w * c, y: shown.y + shown.height / 2 - 0.2 * w * s };
      await page.mouse.click(at.x, at.y);
      await page.waitForTimeout(SETTLE_MS);
      await page.mouse.click(at.x, at.y);
      await expect(page.getByTestId('frame-selection')).toHaveCount(1, { timeout: 15_000 });

      const handles = page.getByTestId('frame-selection-handle');
      const grabbed = centre((await handles.nth(CORNER_BOTTOM_RIGHT).boundingBox())!);
      const pinned = centre((await handles.nth(CORNER_TOP_LEFT).boundingBox())!);
      await page.mouse.move(grabbed.x, grabbed.y);
      await page.mouse.down();
      await page.mouse.move(grabbed.x + DRAG.x, grabbed.y + DRAG.y, { steps: STEPS });
      await page.screenshot({ path: `${SHOTS}/resize-frame-${rotation}-corner.png` });
      const dragged = centre((await handles.nth(CORNER_BOTTOM_RIGHT).boundingBox())!);
      const kept = centre((await handles.nth(CORNER_TOP_LEFT).boundingBox())!);
      await page.mouse.up();
      await page.waitForTimeout(SETTLE_MS);
      expect(Math.hypot(kept.x - pinned.x, kept.y - pinned.y), 'the opposite corner stays put').toBeLessThan(TOLERANCE_PX);
      expect(Math.hypot(dragged.x - grabbed.x - DRAG.x, dragged.y - grabbed.y - DRAG.y), 'the corner follows the pointer').toBeLessThan(TOLERANCE_PX);

      await pullEdge(page, rotation, `frame-${rotation}-edge`);
    });
  }
});
