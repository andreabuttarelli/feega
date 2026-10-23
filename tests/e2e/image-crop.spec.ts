import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import sharp from 'sharp';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const OUT = process.env.IMG_SHOTS ?? join(homedir(), 'Documents', 'feega-videos', 'e2e');
const SETTLE_MS = 2500;
const ZIP_MAGIC = 0x50;
const PICTURE = 64;
const COMPARE = 96;
const MAX_MEAN_DIFF = 6;
const PAN_PX = 40;
const ZOOM_PX = 60;

function pictureBytes(): Buffer {
  const raw = Buffer.alloc(PICTURE * PICTURE * 3);
  for (let y = 0; y < PICTURE; y++) {
    for (let x = 0; x < PICTURE; x++) {
      const left = x < PICTURE / 2;
      const top = y < PICTURE / 2;
      const rgb = left ? (top ? [255, 51, 102] : [255, 212, 0]) : top ? [43, 200, 120] : [43, 43, 255];
      const dot = x > 6 && x < 20 && y > 6 && y < 20;
      raw.set(dot ? [255, 255, 255] : rgb, (y * PICTURE + x) * 3);
    }
  }
  return raw;
}

type Window = { x: number; y: number; w: number; h: number };
type Head = { tracks: { clips: { props: { fills: { fit: string; crop?: Window }[] } }[] }[] };

async function patch(png: Buffer) {
  const meta = await sharp(png).metadata();
  const side = { left: Math.round(0.3 * meta.width!), top: Math.round(0.3 * meta.height!), width: Math.round(0.4 * meta.width!), height: Math.round(0.4 * meta.height!) };
  return sharp(png).extract(side).resize(COMPARE, COMPARE).removeAlpha().raw().toBuffer();
}

async function meanDiff(a: Buffer, b: Buffer) {
  const [x, y] = await Promise.all([patch(a), patch(b)]);
  let total = 0;
  for (let i = 0; i < x.length; i++) {
    total += Math.abs(x[i] - y[i]);
  }
  return total / x.length;
}

test.describe('cropping an image on the canvas @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('double-click crops, drag pans and zooms, Enter applies, and the export agrees', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(240_000);
    mkdirSync(OUT, { recursive: true });
    const png = await sharp(pictureBytes(), { raw: { width: PICTURE, height: PICTURE, channels: 3 } }).png().toBuffer();
    const src = `data:image/png;base64,${png.toString('base64')}`;
    const shape = { id: 'photo', from: 0, durationInFrames: 150, component: 'Shape', props: { x: 0.5, y: 0.5, width: 0.8, height: 0.8, shape: 'rect', fills: [{ type: 'image', src, fit: 'cover' }] } };
    const doc = { version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, background: 'brand', still: { frame: 0 }, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [shape] }], comps: {}, assets: [] };
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const inserted = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(inserted.error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const stage = (await host.boundingBox())!;
    await page.screenshot({ path: join(OUT, 'img-crop-1-before.png'), clip: stage });

    await page.mouse.dblclick(stage.x + stage.width / 2, stage.y + stage.height / 2);
    const handles = page.getByTestId('crop-handles');
    await expect(handles).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('crop-grip-top-left')).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, 'img-crop-2-mode.png') });

    const pan = (await page.getByTestId('crop-pan').boundingBox())!;
    const centre = { x: pan.x + pan.width / 2, y: pan.y + pan.height / 2 };
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.mouse.move(centre.x, centre.y + PAN_PX / 2, { steps: 4 });
    await page.mouse.move(centre.x, centre.y + PAN_PX, { steps: 4 });
    await page.mouse.up();

    const grip = (await page.getByTestId('crop-grip-top-left').boundingBox())!;
    const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - ZOOM_PX / 2, from.y - ZOOM_PX / 2, { steps: 4 });
    await page.mouse.move(from.x - ZOOM_PX, from.y - ZOOM_PX, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(OUT, 'img-crop-3-dragged.png') });

    await page.keyboard.press('Enter');
    await expect(handles).toHaveCount(0);
    await page.waitForTimeout(SETTLE_MS);
    const entered = (await host.boundingBox())!;
    await page.screenshot({ path: join(OUT, 'img-crop-4-applied-page.png') });
    const canvas = await page.screenshot({ path: join(OUT, 'img-crop-4-applied.png'), clip: entered });

    await expect
      .poll(
        async () => {
          const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
          return (data?.[0]?.doc as Head).tracks[0].clips[0].props.fills[0];
        },
        { timeout: 20_000 }
      )
      .toMatchObject({ fit: 'crop' });
    const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
    const window = (data?.[0]?.doc as Head).tracks[0].clips[0].props.fills[0].crop!;
    expect(window.w).toBeLessThan(1);
    expect(window.y).toBeGreaterThanOrEqual(0);
    writeFileSync(join(OUT, 'img-crop-window.json'), JSON.stringify(window));

    const answer = await page.request.post(`/p/${session.projectId}/c/${session.canvasId}?/exportSelection`, {
      headers: { 'x-sveltekit-action': 'true', origin: new URL(page.url()).origin },
      multipart: { frame_ids: JSON.stringify([frame.id]), rows: JSON.stringify([{ format: 'png', by: 'scale', value: 1 }]), name: 'img-crop' }
    });
    const body = JSON.parse(await answer.text()) as { type: string; data: string };
    expect(body.type, body.data).toBe('success');
    const url = (JSON.parse(body.data) as unknown[]).find((v): v is string => typeof v === 'string' && v.startsWith('http'))!;
    const file = Buffer.from(await (await page.request.get(url)).body());
    const exported = file[0] === ZIP_MAGIC ? Buffer.from(Object.values(unzipSync(new Uint8Array(file)))[0]) : file;
    writeFileSync(join(OUT, 'img-crop-5-export.png'), exported);
    expect(await meanDiff(canvas, exported), 'canvas and export agree on the crop').toBeLessThan(MAX_MEAN_DIFF);
  });

  test('Escape leaves the picture as it was, and the Crop image button starts it again', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    const png = await sharp(pictureBytes(), { raw: { width: PICTURE, height: PICTURE, channels: 3 } }).png().toBuffer();
    const src = `data:image/png;base64,${png.toString('base64')}`;
    const shape = { id: 'photo', from: 0, durationInFrames: 150, component: 'Shape', props: { x: 0.5, y: 0.5, width: 0.8, height: 0.8, shape: 'rect', fills: [{ type: 'image', src, fit: 'cover' }] } };
    const doc = { version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, background: 'brand', still: { frame: 0 }, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [shape] }], comps: {}, assets: [] };
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const inserted = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(inserted.error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const stage = (await host.boundingBox())!;
    await page.mouse.dblclick(stage.x + stage.width / 2, stage.y + stage.height / 2);
    await expect(page.getByTestId('crop-handles')).toBeVisible({ timeout: 15_000 });
    const pan = (await page.getByTestId('crop-pan').boundingBox())!;
    await page.mouse.move(pan.x + pan.width / 2, pan.y + pan.height / 2);
    await page.mouse.down();
    await page.mouse.move(pan.x + pan.width / 2, pan.y + pan.height / 2 + PAN_PX, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('crop-handles')).toHaveCount(0);
    await page.waitForTimeout(2000);
    const { data } = await admin.from('motion_revisions').select('doc,version').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
    expect(data?.[0]?.version).toBe(1);
    expect((data?.[0]?.doc as Head).tracks[0].clips[0].props.fills[0].fit).toBe('cover');

    const stack = page.getByTestId('motion-inspector').getByTestId('fill-stack').first();
    await stack.getByTestId('fill-row').first().click();
    await page.getByTestId('fill-crop-edit').click();
    await expect(page.getByTestId('crop-handles')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('crop-apply').click();
    await expect(page.getByTestId('crop-handles')).toHaveCount(0);
    await expect
      .poll(async () => ((await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1)).data?.[0]?.doc as Head).tracks[0].clips[0].props.fills[0].fit, { timeout: 20_000 })
      .toBe('crop');
  });
});
