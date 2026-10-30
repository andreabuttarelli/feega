import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { drawFrame, prepare } from '@feega/motion-core/motion/gpu-full/display-list';
import { createMedia } from '@feega/motion-core/motion/gpu-full/media';
import { loadFonts } from '@feega/motion-core/motion/gpu-full/text/load';
import { smoothingOf } from '@feega/motion-core/motion/gpu-full/text/painter';
import { createCore, createCoreGl, type CoreRaster, type Use } from '@feega/motion-core/motion/gpu-full/core-web';
import { BUDGET, Device } from '$lib/canvas/gpu/memory-budget';
import { stillFrame } from '$lib/canvas/core/frame-source';
import { GpuBackend, type WorldInput, type WorldResult } from './gpu-world';

const ATTACH: Record<GpuBackend, (canvas: HTMLCanvasElement, width: number, height: number, side: number) => Promise<CoreRaster>> = {
  [GpuBackend.WebGpu]: createCore,
  [GpuBackend.WebGl]: createCoreGl
};

const SETTLE_FRAMES = 240;
const UPLOADS_PER_FRAME = 64;
const budget = BUDGET[Device.Desktop];

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

type World = { raster: CoreRaster; media: ReturnType<typeof createMedia>; canvas: HTMLCanvasElement; skipped: Set<string>; unsettled: number };

let world: World | null = null;

async function worldOpen(input: WorldInput): Promise<void> {
  const smoothing = smoothingOf(navigator.userAgent);
  const media = createMedia();
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `display:block;position:fixed;left:0;top:0;width:${input.width}px;height:${input.band}px`;
  document.body.appendChild(canvas);
  const raster = await ATTACH[input.backend](canvas, input.width, input.band, budget.pictureSide);
  raster.setBudget?.(budget.textureBytes);
  const lists = [];
  const uses: Use[] = [];
  for (const [i, item] of input.items.entries()) {
    const doc = item.doc as MotionDoc;
    const fonts = await loadFonts(doc, input.assets, FEEGA_TOKENS);
    const prepared = prepare(doc, FEEGA_TOKENS, input.assets, { fonts, smoothing });
    const list = drawFrame(prepared, stillFrame(doc));
    await media.ready(list);
    const group = `frame-${i}`;
    raster.putGroup(group, list, media.pictures);
    lists.push(list);
    const k = item.width / list.width;
    uses.push({ kind: 'use', clip: group, group, matrix: [k, 0, 0, k, 0, item.top] });
  }
  for (let tries = 0; tries < SETTLE_FRAMES && !lists.every((list) => raster.upload(list, media.pictures, UPLOADS_PER_FRAME)); tries++) {
    await nextFrame();
  }
  raster.patchUses({ put: uses, drop: [] });
  world = { raster, media, canvas, skipped: new Set(), unsettled: 0 };
}

async function worldAt(top: number): Promise<void> {
  const { raster, skipped } = world!;
  raster.setCamera(0, -top, 1);
  let painted = raster.frame(performance.now());
  for (let i = 0; i < SETTLE_FRAMES && (painted.pending || raster.busy?.()); i++) {
    await nextFrame();
    painted = raster.frame(performance.now());
  }
  world!.unsettled += painted.pending ? 1 : 0;
  painted.skipped.forEach((s) => skipped.add(s));
  await nextFrame();
  await nextFrame();
}

function worldClose(input: WorldInput): WorldResult {
  const { raster, media, canvas, skipped, unsettled } = world!;
  raster.dispose();
  media.dispose();
  canvas.remove();
  world = null;
  return { bands: [], skipped: [...skipped], unsettled, backend: input.backend };
}

Object.assign(window, { worldOpen, worldAt, worldClose });
