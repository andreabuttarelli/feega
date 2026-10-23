import sharp from 'sharp';
import type { Page } from '@playwright/test';
import { pickBarTool } from './fixtures/canvas-bar';
import { randomUUID } from 'node:crypto';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };
type Rgb = [number, number, number];

const SHOTS = `${process.env.HOME}/Documents/feega-videos/e2e`;
const HEADED_GPU = process.env.E2E_HEADED_GPU === '1';
const SETTLE_MS = 2500;
const STEPS = 8;
const FRAME_MS = 120;
const DRAG: Point = { x: 120, y: 90 };
const PATCH = 3;
const SAME_SLACK = 30;

if (HEADED_GPU) {
  test.use({ channel: 'chrome', headless: false, launchOptions: { args: ['--enable-unsafe-webgpu'] } });
}

async function rgbAt(page: Page, p: Point): Promise<Rgb> {
  const { data, info } = await sharp(await page.screenshot()).raw().toBuffer({ resolveWithObject: true });
  const sum: Rgb = [0, 0, 0];
  let n = 0;
  for (let y = Math.round(p.y) - PATCH; y <= Math.round(p.y) + PATCH; y++) {
    for (let x = Math.round(p.x) - PATCH; x <= Math.round(p.x) + PATCH; x++) {
      const i = (y * info.width + x) * info.channels;
      sum[0] += data[i];
      sum[1] += data[i + 1];
      sum[2] += data[i + 2];
      n++;
    }
  }
  return sum.map((c) => c / n) as Rgb;
}

const distance = (a: Rgb, b: Rgb) => Math.max(...a.map((c, k) => Math.abs(c - b[k])));

async function draw(page: Page, tool: string): Promise<void> {
  await pickBarTool(page, tool);
  const pane = (await page.getByTestId('core-canvas').boundingBox())!;
  const from = { x: pane.x + pane.width * 0.3, y: pane.y + pane.height * 0.3 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 160, from.y + 120, { steps: 3 });
  await page.mouse.up();
  await expect(page.getByTestId('frame-selection')).toHaveCount(1, { timeout: 15_000 });
  await page.waitForTimeout(SETTLE_MS);
}

async function expectRedrawnMidDrag(page: Page, before: Rect, shot: string, probeY = 1): Promise<void> {
  const thrown: string[] = [];
  page.on('pageerror', (e) => thrown.push(e.message));
  const middle = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
  const fill = await rgbAt(page, middle);
  const grown = { x: before.x + before.width + DRAG.x / 2, y: before.y + before.height * probeY + DRAG.y / 2 };
  const empty = await rgbAt(page, grown);
  expect(distance(fill, empty), 'the probe starts outside the shape').toBeGreaterThan(SAME_SLACK);

  const corner = { x: before.x + before.width, y: before.y + before.height };
  await page.mouse.move(corner.x, corner.y);
  await page.mouse.down();
  await page.mouse.move(corner.x + DRAG.x, corner.y + DRAG.y, { steps: STEPS });
  await page.waitForTimeout(FRAME_MS);
  await page.screenshot({ path: `${SHOTS}/resize2-${shot}.png` });
  const mid = await rgbAt(page, grown);
  await page.mouse.up();
  expect(thrown, `${shot}: nothing throws while the pointer is down`).toEqual([]);
  expect(distance(mid, fill), `${shot}: the shape covers its new area while the pointer is down (${mid} vs fill ${fill})`).toBeLessThan(SAME_SLACK);
}

test.describe('resize redraws the shape itself every frame @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  for (const tool of ['rectangle', 'ellipse']) {
    test(`a free ${tool} fills its new area mid-drag`, async ({ page, session }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1200, height: 800 });
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await draw(page, tool);
      await expectRedrawnMidDrag(page, (await page.getByTestId('frame-selection').boundingBox())!, `free-${tool}${HEADED_GPU ? '-gpu' : ''}`);
    });

    test(`a free ${tool} picked again by a click fills its new area mid-drag`, async ({ page, session }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1200, height: 800 });
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await draw(page, tool);
      const at = (await page.getByTestId('frame-selection').boundingBox())!;
      await page.mouse.click(at.x - 80, at.y - 80);
      await page.waitForTimeout(SETTLE_MS);
      await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
      await page.waitForTimeout(SETTLE_MS);
      await expectRedrawnMidDrag(page, at, `picked-${tool}${HEADED_GPU ? '-gpu' : ''}`);
    });
  }

  for (const tool of ['rectangle', 'ellipse']) {
    test(`a free ${tool} reopened fills its new area mid-drag`, async ({ page, session, admin }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1200, height: 800 });
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await draw(page, tool);
      const posted = async () => (await admin.from('nodes').select('id, data').eq('canvas_id', session.canvasId).eq('type', 'motion').is('deleted_at', null)).data ?? [];
      await expect.poll(async () => (await posted()).length, { timeout: 10_000 }).toBe(1);
      await page.waitForTimeout(SETTLE_MS);
      const id = (await posted())[0].id;
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await page.waitForTimeout(SETTLE_MS);
      const shown = (await page.locator(`[data-frame="${id}"]`).boundingBox())!;
      await page.mouse.click(shown.x + shown.width / 2, shown.y + shown.height / 2);
      await page.waitForTimeout(SETTLE_MS);
      await expectRedrawnMidDrag(page, shown, `reopened-${tool}${HEADED_GPU ? '-gpu' : ''}`);
    });
  }

  test('an element inside a frame fills its new area mid-drag', async ({ page, session, admin, seedNode }) => {
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
    await expectRedrawnMidDrag(page, (await page.getByTestId('frame-selection').boundingBox())!, `frame-element${HEADED_GPU ? '-gpu' : ''}`);
  });

  test('an image fills its new area mid-drag', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1200, height: 800 });
    const size = { width: 400, height: 300 };
    const png = await sharp({ create: { ...size, channels: 3, background: { r: 230, g: 20, b: 20 } } }).png().toBuffer();
    const path = `${session.orgId}/${session.projectId}/e2e/${randomUUID()}.png`;
    await admin.storage.from('canvas-assets').upload(path, png, { contentType: 'image/png' });
    const { data: asset } = await admin.from('assets').insert({ org_id: session.orgId, project_id: session.projectId, type: 'image', url: path, mime_type: 'image/png', bytes: png.length, ...size, source: 'upload' }).select('id').single();
    const image = await seedNode({ type: 'image', x: 0, y: 0, data: { refId: asset!.id } });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);
    const shown = (await page.locator(`[data-id="${image.id}"]`).boundingBox())!;
    await page.mouse.click(shown.x + shown.width / 2, shown.y + shown.height / 2);
    await page.waitForTimeout(SETTLE_MS);
    await expectRedrawnMidDrag(page, shown, `image${HEADED_GPU ? '-gpu' : ''}`, 0.3);
  });

  test('a free image element fills its new area mid-drag', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1200, height: 800 });
    const size = { width: 400, height: 300 };
    const png = await sharp({ create: { ...size, channels: 3, background: { r: 230, g: 20, b: 20 } } }).png().toBuffer();
    const path = `${session.orgId}/${session.projectId}/e2e/${randomUUID()}.png`;
    await admin.storage.from('canvas-assets').upload(path, png, { contentType: 'image/png' });
    const { data: asset } = await admin.from('assets').insert({ org_id: session.orgId, project_id: session.projectId, type: 'image', url: path, mime_type: 'image/png', bytes: png.length, ...size, source: 'upload' }).select('id').single();
    const clip = { id: 'a', from: 0, durationInFrames: 150, component: 'Image', props: { assetId: asset!.id, fit: 'cover', x: 0.5, y: 0.5, width: 1, height: 1 } };
    const doc = { version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, background: 'transparent', tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [clip] }], comps: {}, assets: [] };
    const node = await seedNode({ type: 'motion', x: 0, y: 0, data: { format: '16:9', kind: 'element', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await admin.from('nodes').update({ width: 320, height: 180 }).eq('id', node.id);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);
    const shown = (await page.locator(`[data-frame="${node.id}"]`).boundingBox())!;
    await page.mouse.click(shown.x + shown.width / 2, shown.y + shown.height / 2);
    await page.waitForTimeout(SETTLE_MS);
    await expectRedrawnMidDrag(page, shown, `free-image${HEADED_GPU ? '-gpu' : ''}`);
  });
});
