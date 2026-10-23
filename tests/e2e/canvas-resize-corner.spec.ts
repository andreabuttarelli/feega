import sharp from 'sharp';
import type { Page } from '@playwright/test';
import { pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };
type Rgb = [number, number, number];

const SHOTS = `${process.env.HOME}/Documents/feega-videos/e2e`;
const HEADED_GPU = process.env.E2E_HEADED_GPU === '1';
const SETTLE_MS = 2500;
const FRAME_MS = Number(process.env.FRAME_MS ?? 120);
const STEPS = Number(process.env.STEPS ?? 6);
const DRAG: Point = { x: 150, y: 100 };
const PIXEL_SLACK = 2;
const POINTER_SLACK = 4;
const SAME_COLOUR = 24;
const SEARCH_MARGIN = 40;
const PROBE = 0.25;
const RETINA = 2;

if (HEADED_GPU) {
  test.use({ channel: 'chrome', headless: false, launchOptions: { args: ['--enable-unsafe-webgpu'] } });
}

test.use({ deviceScaleFactor: RETINA });

const distance = (a: Rgb, b: Rgb) => Math.max(...a.map((c, k) => Math.abs(c - b[k])));

async function fillBox(page: Page, colour: Rgb, area: Rect, shot: string): Promise<Rect | null> {
  const png = await page.screenshot({ path: shot, scale: 'css' });
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const matches = (x: number, y: number) => {
    const i = (y * info.width + x) * info.channels;
    return distance([data[i], data[i + 1], data[i + 2]], colour) <= SAME_COLOUR;
  };
  const xs = { min: Infinity, max: -Infinity };
  const ys = { min: Infinity, max: -Infinity };
  for (let y = Math.round(area.y); y < area.y + area.height; y++) {
    for (let x = Math.round(area.x); x < area.x + area.width; x++) {
      if (!matches(x, y)) {
        continue;
      }
      xs.min = Math.min(xs.min, x);
      xs.max = Math.max(xs.max, x);
      ys.min = Math.min(ys.min, y);
      ys.max = Math.max(ys.max, y);
    }
  }
  if (xs.max < 0) {
    return null;
  }
  const row = Math.round(ys.min + (ys.max - ys.min) * PROBE);
  const column = Math.round(xs.min + (xs.max - xs.min) * PROBE);
  const along = (n: number, hit: (k: number) => boolean) => {
    const on = [...Array(n).keys()].filter(hit);
    return { from: on[0], to: on[on.length - 1] };
  };
  const h = along(info.width, (x) => x >= area.x && x < area.x + area.width && matches(x, row));
  const v = along(info.height, (y) => y >= area.y && y < area.y + area.height && matches(column, y));
  return { x: h.from, y: v.from, width: h.to - h.from + 1, height: v.to - v.from + 1 };
}

async function colourAt(page: Page, p: Point): Promise<Rgb> {
  const { data, info } = await sharp(await page.screenshot({ scale: 'css' })).raw().toBuffer({ resolveWithObject: true });
  const i = (Math.round(p.y) * info.width + Math.round(p.x)) * info.channels;
  return [data[i], data[i + 1], data[i + 2]];
}

async function draw(page: Page, tool = 'rectangle', at = 0.3, size: Point = { x: 160, y: 120 }): Promise<void> {
  await pickBarTool(page, tool);
  const pane = (await page.getByTestId('core-canvas').boundingBox())!;
  const from = { x: pane.x + pane.width * at, y: pane.y + pane.height * at };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + size.x, from.y + size.y, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(SETTLE_MS);
  await page.screenshot({ path: `${SHOTS}/resize3-drawn-${tool}.png` });
  if (tool === 'frame') {
    return;
  }
  await expect(page.getByTestId('frame-selection')).toHaveCount(1, { timeout: 15_000 });
}

type Corner = { name: string; ux: 0 | 1; uy: 0 | 1 };
const CORNERS: Corner[] = [
  { name: 'bottom-right', ux: 1, uy: 1 },
  { name: 'top-left', ux: 0, uy: 0 },
  { name: 'top-right', ux: 1, uy: 0 },
  { name: 'bottom-left', ux: 0, uy: 1 }
];

const edges = (r: Rect) => ({ left: r.x, top: r.y, right: r.x + r.width, bottom: r.y + r.height });

function expectEdges(label: string, got: Rect, want: Rect): void {
  const g = edges(got);
  const w = edges(want);
  for (const side of ['left', 'top', 'right', 'bottom'] as const) {
    expect(Math.abs(g[side] - w[side]), `${label}: ${side} edge at ${g[side]}, want ${w[side]}`).toBeLessThanOrEqual(POINTER_SLACK);
  }
}

async function expectCornerResize(page: Page, shot: string, corner: Corner = CORNERS[0]): Promise<void> {
  const selection = page.getByTestId('frame-selection');
  const before = (await selection.boundingBox())!;
  const colour = await colourAt(page, { x: before.x + before.width / 2, y: before.y + before.height / 2 });
  const area = { x: before.x - DRAG.x - SEARCH_MARGIN, y: before.y - DRAG.y - SEARCH_MARGIN, width: before.width + 2 * (DRAG.x + SEARCH_MARGIN), height: before.height + 2 * (DRAG.y + SEARCH_MARGIN) };
  const start = await fillBox(page, colour, area, `${SHOTS}/resize3-${shot}-0.png`);
  expect(start, `${shot}: the fill is visible before the drag`).not.toBeNull();

  const out = { x: corner.ux ? 1 : -1, y: corner.uy ? 1 : -1 };
  const grip = { x: before.x + before.width * corner.ux, y: before.y + before.height * corner.uy };
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  for (let step = 1; step <= STEPS; step++) {
    const d = { x: (out.x * DRAG.x * step) / STEPS, y: (out.y * DRAG.y * step) / STEPS };
    await page.mouse.move(grip.x + d.x, grip.y + d.y);
    await page.waitForTimeout(FRAME_MS);
    const grownBy = (r: Rect): Rect => ({ x: r.x + (corner.ux ? 0 : d.x), y: r.y + (corner.uy ? 0 : d.y), width: r.width + Math.abs(d.x), height: r.height + Math.abs(d.y) });
    const fill = await fillBox(page, colour, area, `${SHOTS}/resize3-${shot}-${step}.png`);
    const label = `${shot} frame ${step}`;
    expect(fill, `${label}: fill visible`).not.toBeNull();
    expectEdges(`${label} fill`, fill!, grownBy(start!));
    expectEdges(`${label} selection`, (await selection.boundingBox())!, grownBy(before));
  }
  await page.mouse.up();
}

test.describe('corner resize pins the opposite corner every frame @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');
  const tag = HEADED_GPU ? '-gpu' : '';

  test('a freshly drawn box', async ({ page, session }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1200, height: 800 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await draw(page);
    await expectCornerResize(page, `fresh${tag}`);
  });

  for (const corner of CORNERS.slice(1)) {
    test(`a freshly drawn box by its ${corner.name} corner`, async ({ page, session }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1200, height: 800 });
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await draw(page);
      await expectCornerResize(page, `fresh-${corner.name}${tag}`, corner);
    });
  }

  test('a freshly drawn box entered by a double click', async ({ page, session }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1200, height: 800 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await draw(page);
    const at = (await page.getByTestId('frame-selection').boundingBox())!;
    await page.mouse.dblclick(at.x + at.width / 2, at.y + at.height / 2);
    await page.waitForTimeout(SETTLE_MS);
    await expectCornerResize(page, `entered${tag}`);
  });

  for (const wheel of [-60, 100]) {
    test(`a freshly drawn box after a ${wheel < 0 ? 'zoom in' : 'zoom out'}`, async ({ page, session }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1200, height: 800 });
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await draw(page);
      const at = (await page.getByTestId('frame-selection').boundingBox())!;
      await page.mouse.move(at.x, at.y);
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, wheel);
      await page.keyboard.up('Control');
      await page.waitForTimeout(SETTLE_MS);
      await expectCornerResize(page, `zoom${wheel}${tag}`);
    });
  }

  test('a box drawn inside a drawn frame', async ({ page, session }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1200, height: 800 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await draw(page, 'frame', 0.1, { x: 600, y: 500 });
    await draw(page, 'rectangle', 0.3);
    await expectCornerResize(page, `drawn-in-frame${tag}`);
  });

  test('a reloaded box', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1200, height: 800 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await draw(page);
    const posted = async () => (await admin.from('nodes').select('id').eq('canvas_id', session.canvasId).is('deleted_at', null)).data ?? [];
    await expect.poll(async () => (await posted()).length, { timeout: 10_000 }).toBe(1);
    await page.waitForTimeout(SETTLE_MS);
    const id = (await posted())[0].id;
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);
    const shown = (await page.locator(`[data-frame="${id}"]`).boundingBox())!;
    await page.mouse.click(shown.x + shown.width / 2, shown.y + shown.height / 2);
    await page.waitForTimeout(SETTLE_MS);
    await expectCornerResize(page, `reloaded${tag}`);
  });

  test('a box inside a frame', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const clip = { id: 'a', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.3, y: 0.4, width: 0.2, height: 0.3, fills: [{ type: 'solid', color: '#ff5a1f' }] } };
    const doc = { version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, background: 'brand', tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [clip] }], comps: {}, assets: [] };
    const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);
    const shown = (await page.locator(`[data-frame="${node.id}"]`).boundingBox())!;
    const at = { x: shown.x + shown.width * 0.3, y: shown.y + shown.height * 0.4 };
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(at.x, at.y);
    await expect(page.getByTestId('frame-selection')).toHaveCount(1, { timeout: 15_000 });
    await page.waitForTimeout(SETTLE_MS);
    await expectCornerResize(page, `in-frame${tag}`);
  });
});
