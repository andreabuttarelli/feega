import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import sharp from 'sharp';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SQUARE = { format: '1:1', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const OUT = process.env.IMG_SHOTS ?? join(homedir(), 'Documents', 'feega-videos', 'e2e');
const RENDERER = process.env.IMG_RENDERER ?? 'core';
const ZIP_MAGIC = 0x50;
const PICTURE = 64;
const MAX_MEAN_DIFF = 6;

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

const shape = (id: string, x: number, y: number, fills: unknown[]) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', props: { x, y, width: 0.28, height: 0.28, shape: 'rect', fills } });
const image = (src: string, extra: Record<string, unknown>) => ({ type: 'image', src, ...extra });

export const SCENES: { id: string; fills: (src: string) => unknown[] }[] = [
  { id: 'cover', fills: (src) => [image(src, { fit: 'cover' })] },
  { id: 'crop', fills: (src) => [image(src, { fit: 'crop', crop: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 } })] },
  { id: 'tile', fills: (src) => [image(src, { fit: 'tile', scale: 2 })] },
  { id: 'tile-turned', fills: (src) => [image(src, { fit: 'tile', scale: 2, rotation: 30 })] }
];

const cell = (index: number) => ({ x: 0.2 + (index % 3) * 0.3, y: 0.25 + Math.floor(index / 3) * 0.4 });

const SIDE = 0.2;
const COMPARE = 96;

async function patch(png: Buffer, index: number) {
  const meta = await sharp(png).metadata();
  const { x, y } = cell(index);
  const at = { left: Math.round((x - SIDE / 2) * meta.width!), top: Math.round((y - SIDE / 2) * meta.height!), width: Math.round(SIDE * meta.width!), height: Math.round(SIDE * meta.height!) };
  return sharp(png).extract(at).resize(COMPARE, COMPARE).removeAlpha().raw().toBuffer();
}

async function meanDiff(a: Buffer, b: Buffer, index: number) {
  const [x, y] = await Promise.all([patch(a, index), patch(b, index)]);
  let total = 0;
  for (let i = 0; i < x.length; i++) {
    total += Math.abs(x[i] - y[i]);
  }
  return total / x.length;
}

test.describe('image fills @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('crop, tile and adjustments look the same on the canvas core and in the export', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(240_000);
    mkdirSync(OUT, { recursive: true });
    const png = await sharp(pictureBytes(), { raw: { width: PICTURE, height: PICTURE, channels: 3 } }).png().toBuffer();
    const src = `data:image/png;base64,${png.toString('base64')}`;
    const clips = SCENES.map((s, i) => shape(s.id, cell(i).x, cell(i).y, s.fills(src)));
    const doc = { version: 5, fps: 30, width: 1080, height: 1080, durationInFrames: 150, background: 'brand', still: { frame: 0 }, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips }], comps: {}, assets: [] };

    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: SQUARE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}?renderer=${RENDERER}`);
    const stage = page.locator(`[data-motion-node="${frame.id}"] [data-frame-stage]`).first();
    await expect(stage).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(4000);
    const box = (await stage.boundingBox())!;
    const canvas = await page.screenshot({ clip: box });
    writeFileSync(join(OUT, 'img-fills-canvas.png'), canvas);

    const answer = await page.request.post(`/p/${session.projectId}/c/${session.canvasId}?/exportSelection`, {
      headers: { 'x-sveltekit-action': 'true', origin: new URL(page.url()).origin },
      multipart: { frame_ids: JSON.stringify([frame.id]), rows: JSON.stringify([{ format: 'png', by: 'scale', value: 1 }]), name: 'img-fills' }
    });
    const body = JSON.parse(await answer.text()) as { type: string; data: string };
    expect(body.type, body.data).toBe('success');
    const url = (JSON.parse(body.data) as unknown[]).find((v): v is string => typeof v === 'string' && v.startsWith('http'))!;
    const file = Buffer.from(await (await page.request.get(url)).body());
    const exported = file[0] === ZIP_MAGIC ? Buffer.from(Object.values(unzipSync(new Uint8Array(file)))[0]) : file;
    writeFileSync(join(OUT, 'img-fills-export.png'), exported);

    for (const [i, scene] of SCENES.entries()) {
      expect(await meanDiff(canvas, exported, i), `${scene.id}: canvas and export agree`).toBeLessThan(MAX_MEAN_DIFF);
    }
  });
});
