import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import sharp from 'sharp';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SQUARE = { format: '1:1', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const OUT = process.env.CONIC_SHOTS ?? join(homedir(), 'Documents', 'feega-videos', 'e2e');
const RENDERER = process.env.CONIC_RENDERER ?? 'core';
const ZIP_MAGIC = 0x50;
const stops = [
  { color: '#ff3366', pos: 0 },
  { color: '#ffd400', pos: 0.5 },
  { color: '#2b2bff', pos: 1 }
];
const angular = { type: 'angular-gradient', angle: 0, center: { x: 0.5, y: 0.5 }, stops };
const diamond = { type: 'diamond-gradient', stops };
const shape = (id: string, x: number, y: number, props: Record<string, unknown>) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', props: { x, y, width: 0.36, height: 0.36, ...props } });

const doc = {
  version: 5,
  fps: 30,
  width: 1080,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  tracks: [
    {
      id: 'v1',
      kind: 'visual',
      name: 'Video 1',
      clips: [
        shape('rect', 0.25, 0.25, { shape: 'rect', fills: [angular] }),
        shape('pen', 0.75, 0.25, { shape: 'path', path: 'M0 0 L1 0.2 L0.6 1 Z', fills: [angular] }),
        shape('ellipse', 0.25, 0.75, { shape: 'ellipse', fills: [diamond] }),
        shape('diamond-pen', 0.75, 0.75, { shape: 'path', path: 'M0.5 0 L1 0.5 L0.5 1 L0 0.5 Z', fills: [diamond] })
      ]
    }
  ],
  comps: {},
  assets: []
};

async function spread(png: Buffer, at: { left: number; top: number; width: number; height: number }) {
  const { channels } = await sharp(png).extract(at).stats();
  return Math.max(...channels.slice(0, 3).map((c) => c.stdev));
}

test.describe('angular and diamond fills @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('draw on the canvas core as in the export, on rects, ellipses and pen paths', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    mkdirSync(OUT, { recursive: true });
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: SQUARE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}?renderer=${RENDERER}`);
    const stage = page.locator(`[data-motion-node="${frame.id}"] [data-frame-stage]`).first();
    await expect(stage).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(3000);
    const box = (await stage.boundingBox())!;
    const canvas = await page.screenshot({ clip: box });
    const backend = await page.evaluate(async () => ((await (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu?.requestAdapter()) ? 'webgpu' : 'webgl'));
    writeFileSync(join(OUT, `conic-canvas-${RENDERER}-${backend}.png`), canvas);

    const scale = canvas.length ? (await sharp(canvas).metadata()).width! / box.width : 1;
    const quadrant = (qx: number, qy: number) => ({ left: Math.round((qx * 0.5 + 0.18) * box.width * scale), top: Math.round((qy * 0.5 + 0.18) * box.height * scale), width: Math.round(0.14 * box.width * scale), height: Math.round(0.14 * box.height * scale) });
    for (const [qx, qy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      expect(await spread(canvas, quadrant(qx, qy)), `shape ${qx},${qy} is drawn with a gradient, not dropped`).toBeGreaterThan(20);
    }

    const answer = await page.request.post(`/p/${session.projectId}/c/${session.canvasId}?/exportSelection`, {
      headers: { 'x-sveltekit-action': 'true', origin: new URL(page.url()).origin },
      multipart: { frame_ids: JSON.stringify([frame.id]), rows: JSON.stringify([{ format: 'png', by: 'scale', value: 1 }]), name: 'conic' }
    });
    const body = JSON.parse(await answer.text()) as { type: string; data: string };
    expect(body.type, body.data).toBe('success');
    const url = (JSON.parse(body.data) as unknown[]).find((v): v is string => typeof v === 'string' && v.startsWith('http'))!;
    const file = Buffer.from(await (await page.request.get(url)).body());
    const exported = file[0] === ZIP_MAGIC ? Buffer.from(Object.values(unzipSync(new Uint8Array(file)))[0]) : file;
    writeFileSync(join(OUT, 'conic-export.png'), exported);
  });
});
