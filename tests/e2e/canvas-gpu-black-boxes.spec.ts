import { homedir } from 'node:os';
import sharp from 'sharp';
import type { Page } from '@playwright/test';
import { pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.FIG_SHOTS ?? `${homedir()}/Documents/feega-videos/e2e`;
const TAG = process.env.SHOT_TAG ?? 'after';
const SETTLE_MS = 2500;
const DARK_LUMA = 24;
const BLACK_BOX_SHARE = 0.5;
const SAMPLES = 8;
const SAMPLE_GAP_MS = 150;
const PICTURE = 256;

type Box = { x: number; y: number; width: number; height: number };

async function shares(page: Page, clip: Box, path?: string): Promise<{ dark: number; ink: number }> {
  const png = await page.screenshot({ clip, ...(path ? { path } : {}) });
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = info.width * info.height;
  let dark = 0;
  let ink = 0;
  for (let i = 0; i < data.length; i += 3) {
    const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    dark += luma < DARK_LUMA ? 1 : 0;
    ink += Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 60 || luma > 200 ? 1 : 0;
  }
  return { dark: dark / px, ink: ink / px };
}

function noisePng(): Promise<Buffer> {
  const raw = Buffer.alloc(PICTURE * PICTURE * 3);
  for (let i = 0; i < raw.length; i += 3) {
    const x = (i / 3) % PICTURE;
    raw.set([x < PICTURE / 2 ? 255 : 40, Math.floor(Math.random() * 256), x < PICTURE / 2 ? 40 : 255], i);
  }
  return sharp(raw, { raw: { width: PICTURE, height: PICTURE, channels: 3 } }).png().toBuffer();
}

const docOf = (clips: unknown[], comps: Record<string, unknown> = {}) => ({ version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, background: 'brand', still: { frame: 0 }, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips }], comps, assets: [] });

test.describe('the GPU canvas never paints a black box @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');
  test.use({ viewport: { width: 1600, height: 1000 } });

  test('typing in a free text leaves the box under the editor clear', async ({ page, session }) => {
    test.setTimeout(150_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await pickBarTool(page, 'text');
    const pane = (await page.locator('.svelte-flow').boundingBox())!;
    const at = { x: pane.x + pane.width * 0.2, y: pane.y + pane.height * 0.4 };
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 120, at.y + 60, { steps: 4 });
    await page.mouse.up();
    const field = page.getByTestId('core-text-edit');
    await expect(field).toBeFocused({ timeout: 15_000 });
    await page.keyboard.type('Hi');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(SETTLE_MS);
    const tile = page.locator('[data-motion-node]').first();
    const before = (await tile.boundingBox())!;

    await tile.dblclick({ force: true });
    await expect(field).toBeFocused({ timeout: 15_000 });
    await page.keyboard.press('End');
    await page.keyboard.type(' typed', { delay: 30 });
    await page.waitForTimeout(800);
    const seen = await shares(page, before, `${SHOTS}/gpu-black-typing-${TAG}.png`);
    expect(seen.dark, 'the box under the editor is not painted black').toBeLessThan(BLACK_BOX_SHARE);
  });

  test('a new shape is never a black box, not even before its first draw', async ({ page, session }) => {
    test.setTimeout(150_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);
    for (const [tool, y] of [['rectangle', 0.3], ['frame', 0.6]] as const) {
      await pickBarTool(page, tool);
      const pane = (await page.locator('.svelte-flow').boundingBox())!;
      const at = { x: pane.x + pane.width * 0.3, y: pane.y + pane.height * y };
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      await page.mouse.move(at.x + 200, at.y + 120, { steps: 4 });
      await page.mouse.up();
      const box = { x: at.x + 20, y: at.y + 20, width: 160, height: 80 };
      let worst = 0;
      for (let i = 0; i < SAMPLES; i++) {
        const seen = await shares(page, box, i === 0 ? `${SHOTS}/gpu-black-new-${tool}-${TAG}.png` : undefined);
        worst = Math.max(worst, seen.dark);
        await page.waitForTimeout(SAMPLE_GAP_MS);
      }
      await page.waitForTimeout(6000);
      await page.screenshot({ path: `${SHOTS}/gpu-black-new-${tool}-settled-${TAG}.png`, clip: { x: at.x - 20, y: at.y - 20, width: 240, height: 160 } });
      await page.keyboard.press('Escape');
      expect(worst, `a new ${tool} is not painted black`).toBeLessThan(BLACK_BOX_SHARE);
    }
  });

  test('an instance draws after picking a variant other than Default', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const solid = (color: string) => [{ type: 'solid', color, opacity: 1, visible: true, blend: 'normal' }];
    const button = (state: string, text: string, color: string) => ({
      name: 'Button',
      durationInFrames: 150,
      component: { name: 'Button', set: 'main', variant: { State: state } },
      tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'pill', component: 'Shape', from: 0, durationInFrames: 150, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.5, height: 0.3, fills: solid(color) } }, { id: 'label', component: 'Text', from: 0, durationInFrames: 150, props: { text, size: 0.1, x: 0.5, y: 0.5, width: 0.5, height: 0.2 } }] }]
    });
    const doc = docOf([{ id: 'button', component: 'Precomp', from: 0, durationInFrames: 150, props: { comp: 'main' } }], { main: button('Default', 'Buy now', '#3b82f6'), hover: button('Hover', 'Buy now →', '#1d4ed8'), done: button('Done', 'Added ✓', '#16a34a') });
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    expect((await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId })).error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const stage = (await host.boundingBox())!;
    await page.mouse.click(stage.x + 4, stage.y + 4);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(stage.x + stage.width / 2, stage.y + stage.height / 2);
    const variant = page.getByTestId('instance-variant');
    await expect(variant).toBeVisible({ timeout: 15_000 });
    for (const state of ['Hover', 'Done']) {
      await variant.selectOption(state);
      await page.waitForTimeout(SETTLE_MS);
      await page.screenshot({ path: `${SHOTS}/gpu-black-variant-${state.toLowerCase()}-${TAG}.png`, clip: stage });
      const pill = await shares(page, { x: stage.x + stage.width * 0.35, y: stage.y + stage.height * 0.38, width: stage.width * 0.3, height: stage.height * 0.06 });
      expect(pill.dark, `the ${state} instance draws its pill`).toBeLessThan(BLACK_BOX_SHARE);
    }
  });

  test('an instance draws after adding a variant in Properties and picking it', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const pill = { id: 'pill', component: 'Shape', from: 0, durationInFrames: 150, props: { x: 0.5, y: 0.5, width: 0.6, height: 0.3, shape: 'rect', fill: '#2f6fe0' } };
    const main = { name: 'Button', durationInFrames: 150, component: { name: 'Button' }, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [pill] }] };
    const doc = docOf([{ id: 'button', component: 'Precomp', from: 0, durationInFrames: 150, props: { comp: 'main' } }], { main });
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    expect((await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId })).error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const stage = (await host.boundingBox())!;
    await page.mouse.click(stage.x + 4, stage.y + 4);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(stage.x + stage.width / 2, stage.y + stage.height / 2);
    await page.getByTestId('instance-add-variant').click();
    const variant = page.getByTestId('instance-variant');
    await expect(variant).toBeVisible({ timeout: 15_000 });
    const values = await variant.locator('option').allTextContents();
    await variant.selectOption(values.find((v) => v !== 'Default')!);
    await page.waitForTimeout(SETTLE_MS);
    const seen = await shares(page, stage, `${SHOTS}/gpu-black-variant-added-${TAG}.png`);
    expect(seen.ink, 'the added variant draws its pill').toBeGreaterThan(0.05);
  });

  test('an image fill embedded as a large data URL draws and crops', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const src = `data:image/png;base64,${(await noisePng()).toString('base64')}`;
    expect(src.length).toBeGreaterThan(10_000);
    const shape = { id: 'photo', from: 0, durationInFrames: 150, component: 'Shape', props: { x: 0.5, y: 0.5, width: 0.8, height: 0.8, shape: 'rect', fills: [{ type: 'image', src, fit: 'cover' }] } };
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    expect((await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: docOf([shape]), actor_kind: 'user', actor_id: session.userId })).error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const stage = (await host.boundingBox())!;
    const seen = await shares(page, stage, `${SHOTS}/gpu-black-dataurl-${TAG}.png`);
    expect(seen.ink, 'the picture is drawn').toBeGreaterThan(0.3);
    await page.mouse.dblclick(stage.x + stage.width / 2, stage.y + stage.height / 2);
    await expect(page.getByTestId('crop-handles')).toBeVisible({ timeout: 15_000 });
  });
});
