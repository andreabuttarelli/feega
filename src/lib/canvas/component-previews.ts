import { FullBackend } from '@feega/motion-core/motion/gpu-full/backends';
import type { FrameDoc } from '$lib/canvas/core/frame-build';
import { frameOfLive } from '$lib/canvas/core/frame-source';
import { BUDGET, currentDevice } from '$lib/canvas/gpu/memory-budget';
import { Tone, fitInTile, inkBounds, padded, previewCache, previewDoc, previewKey, previewSide, shownBox, toneOf } from './component-preview';
import type { Crop } from '$lib/motion/export-vector';

export type PreviewAsk = { projectId: string; canvasId: string; frameId: string; compId: string; revision: number };

const BUDGET_SHARE = 32;
const PROBE_SCALE = 2;
const PADDING = 0.08;

export type Preview = { bitmap: ImageBitmap; tone: Tone; width: number; height: number; close: () => void };
const TRIED = [FullBackend.Core, FullBackend.CoreGl];

const device = currentDevice();
const cache = previewCache<Preview>(BUDGET[device].textureBytes / BUDGET_SHARE);
const inFlight = new Map<string, Promise<Preview | null>>();
let queue: Promise<unknown> = Promise.resolve();

const sourceUrl = (ask: PreviewAsk) => `/p/${encodeURIComponent(ask.projectId)}/c/${encodeURIComponent(ask.canvasId)}/motion/${encodeURIComponent(ask.frameId)}/source?revision=${ask.revision}`;

async function fetchFrame(ask: PreviewAsk): Promise<FrameDoc | null> {
  const res = await fetch(sourceUrl(ask)).catch(() => null);
  return res?.ok ? ((await res.json()) as FrameDoc) : null;
}

async function probe(full: ImageBitmap, crop: Crop, side: number): Promise<{ ink: Crop; tone: Tone }> {
  const fit = fitInTile(crop, side);
  const [width, height] = [Math.max(1, fit.width), Math.max(1, fit.height)];
  const small = await createImageBitmap(full, Math.round(crop.left), Math.round(crop.top), Math.max(1, Math.round(crop.width)), Math.max(1, Math.round(crop.height)), { resizeWidth: width, resizeHeight: height });
  const context = new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true })!;
  context.drawImage(small, 0, 0);
  small.close();
  const { data } = context.getImageData(0, 0, width, height);
  const found = inkBounds(data, width, height);
  const ink = found ? padded({ left: crop.left + found.left / fit.scale, top: crop.top + found.top / fit.scale, width: found.width / fit.scale, height: found.height / fit.scale }, PADDING) : crop;
  return { ink, tone: toneOf(data) };
}

async function render(ask: PreviewAsk): Promise<Preview | null> {
  const frame = await fetchFrame(ask);
  if (!frame) {
    return null;
  }

  const [{ renderOnCore }, { prepare, drawFrame, textBoxesAt }, { loadFonts }, { smoothingOf }] = await Promise.all([import('$lib/motion/gpu-full/core-export'), import('@feega/motion-core/motion/gpu-full/display-list'), import('@feega/motion-core/motion/gpu-full/text/load'), import('@feega/motion-core/motion/gpu-full/text/painter')]);
  const doc = previewDoc(frame.doc, ask.compId);
  const prepared = prepare(doc, frame.tokens, frame.assets, { fonts: await loadFonts(doc, frame.assets, frame.tokens), smoothing: smoothingOf(navigator.userAgent) });
  const still = frameOfLive({ doc });
  const crop = shownBox(drawFrame(prepared, still), textBoxesAt(prepared, still));
  if (!crop) {
    return null;
  }

  const side = previewSide(device, devicePixelRatio);
  const noReads = { readAt: async () => ({ reads: new Map(), picture: () => null }), dispose: () => undefined };
  let shot: Preview | null = null;
  const keep = async (full: ImageBitmap) => {
    const { ink, tone } = await probe(full, crop, side * PROBE_SCALE);
    const fit = fitInTile(ink, side);
    const bitmap = await createImageBitmap(full, Math.round(ink.left), Math.round(ink.top), Math.max(1, Math.round(ink.width)), Math.max(1, Math.round(ink.height)), { resizeWidth: Math.max(1, fit.width), resizeHeight: Math.max(1, fit.height), resizeQuality: 'high' });
    full.close();
    shot = { bitmap, tone, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  };

  for (const backend of TRIED) {
    if (await renderOnCore(prepared, backend, [still / doc.fps], keep, new AbortController().signal, noReads).catch(() => false)) {
      return shot;
    }
  }
  return null;
}

export function componentPreview(ask: PreviewAsk): Promise<Preview | null> {
  const key = previewKey(ask.compId, ask.revision);
  const held = cache.get(key);
  if (held) {
    return Promise.resolve(held);
  }

  const pending = inFlight.get(key);
  if (pending) {
    return pending;
  }

  const made = queue.then(() => render(ask)).catch(() => null).then((preview) => {
    inFlight.delete(key);
    if (preview) {
      cache.put(key, preview);
    }
    return preview;
  });
  queue = made.catch(() => null);
  inFlight.set(key, made);
  return made;
}
