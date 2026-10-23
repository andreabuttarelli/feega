import type { Locator, Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

type Point = { x: number; y: number };

const SHOTS = `${process.env.HOME}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2500;
const STEPS = 12;
const TURN = 40;
const FIRST_TURN = 25;
const SNAP_DRAG = 32;
const SNAP_STEP = 15;
const FRAME_TURN = 20;
const OUT_PX = 10;
const TOLERANCE_DEG = 1;
const CURSOR_TOLERANCE_DEG = 2;
const ZOOM_TARGET = 1.9;
const WHEEL_STEP = -40;
const MAX_WHEELS = 40;
const CORNER_BOTTOM_RIGHT = 2;
const CORNER_COUNT = 4;
const CURSOR_BASE_DEG = 135;
const FULL_TURN = 360;
const HALF_TURN = 180;

const RAD = Math.PI / HALF_TURN;
const centre = async (l: Locator): Promise<Point> => {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const wrap = (deg: number) => ((((deg + HALF_TURN) % FULL_TURN) + FULL_TURN) % FULL_TURN) - HALF_TURN;
const around = (c: Point, p: Point, deg: number): Point => ({
  x: c.x + (p.x - c.x) * Math.cos(deg * RAD) - (p.y - c.y) * Math.sin(deg * RAD),
  y: c.y + (p.x - c.x) * Math.sin(deg * RAD) + (p.y - c.y) * Math.cos(deg * RAD)
});

type Corners = { at: Point[]; centre: Point };

async function cornersOf(selection: Locator): Promise<Corners> {
  const handles = selection.getByTestId('frame-selection-handle');
  const at = await Promise.all([0, 1, 2, 3].map((i) => centre(handles.nth(i))));
  return { at, centre: { x: (at[0].x + at[2].x) / 2, y: (at[0].y + at[2].y) / 2 } };
}

const unit = (a: Point, b: Point): Point => {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
};

function diagonal(c: Corners, i: number): Point {
  const along = unit(c.at[(i + 1) % CORNER_COUNT], c.at[i]);
  const across = unit(c.at[(i + CORNER_COUNT - 1) % CORNER_COUNT], c.at[i]);
  return { x: along.x + across.x, y: along.y + across.y };
}

function outsideCorner(c: Corners, i: number): Point {
  const out = diagonal(c, i);
  return { x: c.at[i].x + OUT_PX * out.x, y: c.at[i].y + OUT_PX * out.y };
}

async function cursorAt(page: Page, p: Point): Promise<{ cursor: string; covered: boolean }> {
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(100);
  return page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y)!;
    return { cursor: getComputedStyle(el).cursor, covered: !!el.closest('[role="toolbar"]') };
  }, [p.x, p.y]);
}

function expectRotateCursor(cursor: string, c: Corners, i: number) {
  expect(cursor, 'a custom cursor, not a resize arrow').toContain('data:image/svg+xml');
  const turn = Number(/rotate\((-?[\d.]+)/.exec(decodeURIComponent(cursor))?.[1]);
  const out = Math.atan2(diagonal(c, i).y, diagonal(c, i).x) / RAD;
  expect(Math.abs(wrap(turn - (out + CURSOR_BASE_DEG))), `cursor at corner ${i} points outward`).toBeLessThanOrEqual(CURSOR_TOLERANCE_DEG);
}

async function sweepCorners(page: Page, selection: Locator) {
  const corners = await cornersOf(selection);
  let checked = 0;
  for (let i = 0; i < CORNER_COUNT; i++) {
    const { cursor, covered } = await cursorAt(page, outsideCorner(corners, i));
    if (covered) {
      continue;
    }
    expectRotateCursor(cursor, corners, i);
    checked++;
  }
  expect(checked, 'corners not under the floating toolbar').toBeGreaterThanOrEqual(CORNER_COUNT - 1);
}

async function turnBy(page: Page, selection: Locator, deg: number, shot: string) {
  const corners = await cornersOf(selection);
  const from = outsideCorner(corners, CORNER_BOTTOM_RIGHT);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let s = 1; s <= STEPS; s++) {
    const to = around(corners.centre, from, (deg * s) / STEPS);
    await page.mouse.move(to.x, to.y);
  }
  await page.screenshot({ path: `${SHOTS}/rotate-${shot}.png` });
  await page.mouse.up();
}

async function drawBox(page: Page): Promise<string> {
  await pickBarTool(page, 'rectangle');
  const pane = (await page.getByTestId('core-canvas').boundingBox())!;
  const from = { x: pane.x + pane.width * 0.3, y: pane.y + pane.height * 0.3 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 160, from.y + 100, { steps: 3 });
  await page.mouse.up();
  await expect(page.getByTestId('frame-selection')).toHaveCount(1, { timeout: 15_000 });
  await page.waitForTimeout(SETTLE_MS);
  return (await page.locator('[data-kind="element"][data-motion-node]').getAttribute('data-motion-node'))!;
}

async function zoomIn(page: Page, selection: Locator) {
  const start = (await selection.boundingBox())!;
  const at = await centre(selection);
  await page.mouse.move(at.x, at.y);
  await page.keyboard.down('Control');
  for (let i = 0; i < MAX_WHEELS && (await selection.boundingBox())!.width < start.width * ZOOM_TARGET; i++) {
    await page.mouse.wheel(0, WHEEL_STEP);
    await page.waitForTimeout(60);
  }
  await page.keyboard.up('Control');
  await page.waitForTimeout(SETTLE_MS);
}

const nodeRotation = async (admin: SupabaseClient, id: string) =>
  Number(((await admin.from('nodes').select('data').eq('id', id).single()).data?.data as { rotation?: number })?.rotation ?? 0);

const clipRotation = async (admin: SupabaseClient, id: string) => {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', id).order('version', { ascending: false }).limit(1).single();
  const clips = (data!.doc as { tracks: { clips: { id: string; transform?: { rotateZ?: number } }[] }[] }).tracks.flatMap((t) => t.clips);
  return Number(clips.find((c) => c.id === 'a')?.transform?.rotateZ ?? 0);
};

test.describe('rotate from just outside a corner, like Figma @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  for (const zoomed of [false, true]) {
    test(`a free element${zoomed ? ' at zoom 2' : ''}: rotate cursor outside every corner, drag turns about the centre, then again once turned`, async ({ page, session, admin }) => {
      test.setTimeout(150_000);
      await page.setViewportSize({ width: 1200, height: 800 });
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      const id = await drawBox(page);
      const selection = page.getByTestId('frame-selection');
      if (zoomed) {
        await zoomIn(page, selection);
      }
      const label = zoomed ? 'free-zoom2' : 'free-zoom1';
      await sweepCorners(page, selection);

      await turnBy(page, selection, FIRST_TURN, `${label}-0`);
      await expect.poll(async () => Math.abs((await nodeRotation(admin, id)) - FIRST_TURN), { timeout: 10_000 }).toBeLessThanOrEqual(TOLERANCE_DEG);
      await page.waitForTimeout(SETTLE_MS);
      await page.screenshot({ path: `${SHOTS}/rotate-${label}-turned.png` });
      await sweepCorners(page, selection);

      await turnBy(page, selection, TURN, `${label}-1`);
      await expect.poll(async () => Math.abs((await nodeRotation(admin, id)) - (FIRST_TURN + TURN)), { timeout: 10_000 }).toBeLessThanOrEqual(TOLERANCE_DEG);
    });
  }

  test('Shift snaps the turn to 15 degrees', async ({ page, session, admin }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1200, height: 800 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const id = await drawBox(page);
    const selection = page.getByTestId('frame-selection');
    await page.keyboard.down('Shift');
    await turnBy(page, selection, SNAP_DRAG, 'free-snap');
    await page.keyboard.up('Shift');
    await expect.poll(async () => nodeRotation(admin, id), { timeout: 10_000 }).toBe(Math.round(SNAP_DRAG / SNAP_STEP) * SNAP_STEP);
  });

  for (const zoomed of [false, true]) {
    test(`an element in a turned frame${zoomed ? ' at zoom 2' : ''}: same cursor and turn`, async ({ page, session, admin, seedNode }) => {
      test.setTimeout(150_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      const clip = { id: 'a', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.3, y: 0.5, width: 0.2, height: 0.3, fills: [{ type: 'solid', color: '#ff5a1f' }] } };
      const doc = { version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, background: 'brand', tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [clip] }], comps: {}, assets: [] };
      const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, rotation: FRAME_TURN } });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await page.waitForTimeout(SETTLE_MS);
      const shown = (await page.locator(`[data-frame="${node.id}"]`).boundingBox())!;
      const [c, s] = [Math.cos(FRAME_TURN * RAD), Math.sin(FRAME_TURN * RAD)];
      const w = (shown.width * c - shown.height * s) / (c * c - s * s);
      const at = { x: shown.x + shown.width / 2 - 0.2 * w * c, y: shown.y + shown.height / 2 - 0.2 * w * s };
      await page.mouse.click(at.x, at.y);
      await page.waitForTimeout(SETTLE_MS);
      await page.mouse.click(at.x, at.y);
      const selection = page.getByTestId('frame-selection');
      await expect(selection).toHaveCount(1, { timeout: 15_000 });
      if (zoomed) {
        await zoomIn(page, selection);
      }
      const label = zoomed ? 'frame-zoom2' : 'frame-zoom1';
      await sweepCorners(page, selection);

      const before = await clipRotation(admin, node.id);
      await turnBy(page, selection, TURN, label);
      await expect.poll(async () => Math.abs((await clipRotation(admin, node.id)) - before - TURN), { timeout: 15_000 }).toBeLessThanOrEqual(TOLERANCE_DEG);
    });
  }
});
