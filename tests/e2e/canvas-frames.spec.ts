import sharp from 'sharp';
import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { landingDoc } from './fixtures/landing-frame-doc';

const SHOTS_DIR = `${process.env.HOME}/Documents/feega-videos/e2e`;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const FRAME_AT = { x: 200, y: 200 };
const FRAME_SIZE = { width: 800, height: 450 };
const ORANGE: Rgb = [255, 90, 31];
const COLOUR_TOLERANCE = 40;
const GROUND_DELTA = 12;
const EDGE_TOLERANCE_PX = 2;
const SIZE_TOLERANCE_PX = 3;
const MIN_FILLED_RATIO = 0.05;
const MIN_LIGHT = 24;
const SETTLE_MS = 6000;
const ZOOMS = [1, 0.6];
const ZOOM_TOLERANCE = 0.04;
const ZOOM_STEPS = 300;
const TITLE_OFFSET_PX = 12;
const HANDLE_COUNT = 8;
const VIEWPORT = { width: 1440, height: 900 };
const EMPTY_SPOT = { x: 1380, y: 860 };

type Rgb = [number, number, number];
type Rect = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };

const shape = (id: string, x: number, y: number, width: number, height: number, color: string) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x, y, width, height, fills: [{ type: 'solid', color }] } });
const text = (id: string, label: string, x: number, y: number) => ({ id, from: 0, durationInFrames: 150, component: 'Text', props: { text: label, size: 0.12, x, y, width: 0.4, height: 0.2, color: '#ffffff', font: 'sans' } });

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [shape('bg', 0.5, 0.5, 1, 1, '#1b2a49'), shape('rect', 0.3, 0.55, 0.2, 0.25, '#ff5a1f'), text('title', 'Hello frame', 0.7, 0.2), shape('g1', 0.7, 0.65, 0.12, 0.16, '#2fbf71'), shape('g2', 0.82, 0.65, 0.08, 0.16, '#f2c94c')] }],
  comps: {},
  assets: []
};

const near = (px: Rgb, want: Rgb) => px.every((c, i) => Math.abs(c - want[i]) <= COLOUR_TOLERANCE);
const centre = (r: Rect): Point => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

async function grab(page: Page, area: Rect) {
  const { data, info } = await sharp(await page.screenshot({ clip: area })).raw().toBuffer({ resolveWithObject: true });
  const scale = info.width / area.width;
  const at = (x: number, y: number): Rgb => {
    const i = (Math.round(y * scale) * info.width + Math.round(x * scale)) * info.channels;
    return [data[i], data[i + 1], data[i + 2]];
  };
  return { at };
}

async function filledRatio(page: Page, area: Rect): Promise<number> {
  const { at } = await grab(page, area);
  const ground = at(2, 2);
  let filled = 0;
  let total = 0;
  for (let y = 4; y < area.height - 4; y += 4) {
    for (let x = 4; x < area.width - 4; x += 4) {
      total += 1;
      filled += at(x, y).some((c, i) => Math.abs(c - ground[i]) > GROUND_DELTA) ? 1 : 0;
    }
  }
  return filled / total;
}

async function colourBounds(page: Page, area: Rect, want: Rgb): Promise<Rect | null> {
  const { at } = await grab(page, area);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let y = 0; y < area.height; y += 1) {
    for (let x = 0; x < area.width; x += 1) {
      if (near(at(x, y), want)) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }
  return x1 < 0 ? null : { x: area.x + x0, y: area.y + y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

function expectAligned(actual: Rect, drawn: Rect, label: string) {
  expect(Math.abs(actual.x - drawn.x), `${label} left`).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
  expect(Math.abs(actual.y - drawn.y), `${label} top`).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
  expect(Math.abs(actual.x + actual.width - drawn.x - drawn.width), `${label} right`).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
  expect(Math.abs(actual.y + actual.height - drawn.y - drawn.height), `${label} bottom`).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
}

function expectSameBox(actual: Rect, before: Rect, label: string) {
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(actual[key] - before[key]), `${label}: ${key}`).toBeLessThanOrEqual(SIZE_TOLERANCE_PX);
  }
}

const snap = (page: Page, name: string) => page.screenshot({ path: `${SHOTS_DIR}/frames-${name}.png` });

async function zoomOf(page: Page): Promise<number> {
  return page.locator('.svelte-flow__viewport').first().evaluate((el) => Number(/scale\(([\d.]+)\)/.exec(el.getAttribute('style') ?? '')?.[1] ?? 1));
}

async function zoomTo(page: Page, target: number) {
  await page.mouse.move(VIEWPORT.width - 8, VIEWPORT.height - 8);
  await page.keyboard.down('Control');
  for (let i = 0; i < ZOOM_STEPS; i++) {
    const z = await zoomOf(page);
    if (Math.abs(z - target) / target < ZOOM_TOLERANCE) {
      break;
    }
    await page.mouse.wheel(0, z < target ? -4 : 4);
  }
  await page.keyboard.up('Control');
  await page.waitForTimeout(SETTLE_MS);
}

test.use({ headless: !process.env.E2E_HEADED, launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });

test.describe('a core-drawn frame stays itself through hover, select and deselect @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(180_000);

  test('visible, one hover highlight on the element, selection keeps the frame drawn, title click and deselect too', async ({ page, session, admin, seedNode }) => {
    await page.setViewportSize(VIEWPORT);
    const node = await seedNode({ type: 'motion', x: FRAME_AT.x, y: FRAME_AT.y, data: LANDSCAPE });
    await admin.from('nodes').update({ width: FRAME_SIZE.width, height: FRAME_SIZE.height }).eq('id', node.id);
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
    const tile = page.locator(`[data-testid="gpu-node"][data-id="${node.id}"]`);
    await expect(tile).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const frameRect = async (): Promise<Rect> => (await tile.boundingBox())!;

    const before = await frameRect();
    await snap(page, '1-loaded');
    expect(await filledRatio(page, before), '1. frame drawn after load').toBeGreaterThan(MIN_FILLED_RATIO);
    expect(await colourBounds(page, before, ORANGE), '1. the orange rect is drawn').not.toBeNull();

    await expect(page.getByTestId('layers'), '5. layers tree closed').toHaveCount(0);
    for (const zoom of ZOOMS) {
      await zoomTo(page, zoom);
      const drawn = (await colourBounds(page, await frameRect(), ORANGE))!;
      const c = centre(drawn);
      await page.mouse.move(c.x - 20, c.y - 20);
      await page.mouse.move(c.x, c.y, { steps: 6 });
      const hover = page.getByTestId('frame-pick-box');
      await expect(hover, `2. exactly one hover rect at zoom ${zoom}`).toHaveCount(1);
      expectAligned((await hover.boundingBox())!, drawn, `2. hover at zoom ${zoom}`);
      await snap(page, `2-hover-zoom-${zoom}`);
    }
    await zoomTo(page, 1);
    await page.mouse.move(5, 5);

    const start = await frameRect();
    const drawn = (await colourBounds(page, start, ORANGE))!;
    const c = centre(drawn);
    await page.mouse.click(c.x, c.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.move(5, 5);
    await snap(page, '3-selected');
    const after = await frameRect();
    expectSameBox(after, start, '3. frame box after selecting an element');
    expect(await filledRatio(page, after), '3. frame still drawn after select').toBeGreaterThan(MIN_FILLED_RATIO);
    const { at } = await grab(page, after);
    expect(Math.max(...at(after.width * 0.55, after.height * 0.1)), '3. not black').toBeGreaterThan(MIN_LIGHT);
    const kept = await colourBounds(page, after, ORANGE);
    expect(kept, '3. the element is still drawn').not.toBeNull();
    expectSameBox(kept!, drawn, '3. element not resized');
    const handles = page.getByTestId('frame-selection');
    await expect(handles, '3. selection box').toHaveCount(1);
    expectAligned((await handles.boundingBox())!, kept!, '3. selection box');
    await expect(page.getByTestId('frame-selection-handle'), '3. eight handles').toHaveCount(HANDLE_COUNT);

    await page.mouse.click(after.x + TITLE_OFFSET_PX, after.y - TITLE_OFFSET_PX);
    await page.waitForTimeout(SETTLE_MS);
    await snap(page, '4-title');
    const titled = await frameRect();
    expectSameBox(titled, start, '4. frame box after title click');
    expect(await filledRatio(page, titled), '4. drawn after title click').toBeGreaterThan(MIN_FILLED_RATIO);

    await page.mouse.click(EMPTY_SPOT.x, EMPTY_SPOT.y);
    await page.waitForTimeout(SETTLE_MS);
    await snap(page, '5-deselected');
    const idle = await frameRect();
    expectSameBox(idle, start, '4. frame box after deselect');
    expect(await filledRatio(page, idle), '4. drawn after deselect').toBeGreaterThan(MIN_FILLED_RATIO);
  });
});

const LANDING_SIZE = { width: 1440, height: 4734 };
const LANDING_DATA = { format: 'custom', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const PAGE_DARK = 60;
const DARK_RATIO_DRIFT = 0.05;
const LANDING_SPOTS: Record<string, Point> = { nav: { x: 300, y: 36 }, card: { x: 900, y: 600 } };

const LANDING_ZOOM = 0.55;
const ABOVE_PANELS: Rect = { x: 48, y: 52, width: 1100, height: 540 };

const onScreen = (r: Rect): Rect => {
  const x = Math.max(ABOVE_PANELS.x, r.x);
  const y = Math.max(ABOVE_PANELS.y, r.y);
  return { x, y, width: Math.min(r.x + r.width, ABOVE_PANELS.x + ABOVE_PANELS.width) - x, height: Math.min(r.y + r.height, ABOVE_PANELS.y + ABOVE_PANELS.height) - y };
};

async function zoomInto(page: Page, at: Point, target: number) {
  await page.mouse.move(at.x, at.y);
  await page.keyboard.down('Control');
  for (let i = 0; i < ZOOM_STEPS && (await zoomOf(page)) < target; i++) {
    await page.mouse.wheel(0, -4);
  }
  await page.keyboard.up('Control');
  await page.waitForTimeout(SETTLE_MS);
}

async function darkArea(page: Page, area: Rect): Promise<{ ratio: number; bounds: Rect | null }> {
  const view = onScreen(area);
  const { at } = await grab(page, view);
  let dark = 0;
  let total = 0;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let y = 0; y < view.height - 1; y += 2) {
    for (let x = 0; x < view.width - 1; x += 2) {
      total += 1;
      if (Math.max(...at(x, y)) >= PAGE_DARK) {
        continue;
      }
      dark += 1;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return { ratio: dark / total, bounds: x1 < 0 ? null : { x: view.x + x0, y: view.y + y0, width: x1 - x0 + 2, height: y1 - y0 + 2 } };
}

test.describe('a landing-page frame stays drawn when an element inside it is selected @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(180_000);

  test('clicking the nav or a card keeps the whole page drawn, same box, same pixels', async ({ page, session, admin, seedNode }) => {
    await page.setViewportSize(VIEWPORT);
    const node = await seedNode({ type: 'motion', x: FRAME_AT.x, y: FRAME_AT.y, data: LANDING_DATA });
    await admin.from('nodes').update(LANDING_SIZE).eq('id', node.id);
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: landingDoc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
    const tile = page.locator(`[data-testid="gpu-node"][data-id="${node.id}"]`);
    await expect(tile).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const fitted = (await tile.boundingBox())!;
    await zoomInto(page, { x: fitted.x + fitted.width / 2, y: fitted.y }, LANDING_ZOOM);

    const start = (await tile.boundingBox())!;
    const loaded = await darkArea(page, start);
    await snap(page, 'landing-1-loaded');
    expect(loaded.ratio, 'landing drawn after load').toBeGreaterThan(MIN_FILLED_RATIO);
    expectAligned(loaded.bounds!, onScreen(start), 'landing drawn over its whole tile');

    const scale = start.width / LANDING_SIZE.width;
    for (const [name, spot] of Object.entries(LANDING_SPOTS)) {
      await page.mouse.click(start.x + spot.x * scale, start.y + spot.y * scale);
      await page.waitForTimeout(SETTLE_MS);
      await page.mouse.move(EMPTY_SPOT.x, EMPTY_SPOT.y);
      await snap(page, `landing-2-${name}`);
      await expect(page.getByTestId('frame-selection'), `${name} selected`).toHaveCount(1);
      const after = (await tile.boundingBox())!;
      expectSameBox(after, start, `${name}: tile box`);
      const drawn = await darkArea(page, after);
      expect(drawn.bounds, `${name}: landing still drawn`).not.toBeNull();
      expectSameBox(drawn.bounds!, loaded.bounds!, `${name}: drawn landing box`);
      expect(Math.abs(drawn.ratio - loaded.ratio), `${name}: landing pixels unchanged`).toBeLessThanOrEqual(DARK_RATIO_DRIFT);
    }
  });
});
