import { FullBackend } from '@feega/motion-core/motion/gpu-full/backends';
import type { FrameDoc } from '$lib/canvas/core/frame-build';
import { frameOfLive } from '$lib/canvas/core/frame-source';
import { BUDGET, currentDevice } from '$lib/canvas/gpu/memory-budget';
import { fitInTile, previewCache, previewDoc, previewKey, previewSide, shownBox } from './component-preview';

export type PreviewAsk = { projectId: string; canvasId: string; frameId: string; compId: string; revision: number };

const BUDGET_SHARE = 32;
const TRIED = [FullBackend.Core, FullBackend.CoreGl];

const device = currentDevice();
const cache = previewCache<ImageBitmap>(BUDGET[device].textureBytes / BUDGET_SHARE);
const inFlight = new Map<string, Promise<ImageBitmap | null>>();
let queue: Promise<unknown> = Promise.resolve();

const sourceUrl = (ask: PreviewAsk) => `/p/${encodeURIComponent(ask.projectId)}/c/${encodeURIComponent(ask.canvasId)}/motion/${encodeURIComponent(ask.frameId)}/source?revision=${ask.revision}`;

async function fetchFrame(ask: PreviewAsk): Promise<FrameDoc | null> {
  const res = await fetch(sourceUrl(ask)).catch(() => null);
  return res?.ok ? ((await res.json()) as FrameDoc) : null;
}

async function render(ask: PreviewAsk): Promise<ImageBitmap | null> {
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

  const fit = fitInTile(crop, previewSide(device, devicePixelRatio));
  const noReads = { readAt: async () => ({ reads: new Map(), picture: () => null }), dispose: () => undefined };
  let shot: ImageBitmap | null = null;
  const keep = async (full: ImageBitmap) => {
    shot = await createImageBitmap(full, crop.left, crop.top, crop.width, crop.height, { resizeWidth: Math.max(1, fit.width), resizeHeight: Math.max(1, fit.height), resizeQuality: 'high' });
    full.close();
  };

  for (const backend of TRIED) {
    if (await renderOnCore(prepared, backend, [still / doc.fps], keep, new AbortController().signal, noReads).catch(() => false)) {
      return shot;
    }
  }
  return null;
}

export function componentPreview(ask: PreviewAsk): Promise<ImageBitmap | null> {
  const key = previewKey(ask.compId, ask.revision);
  const held = cache.get(key);
  if (held) {
    return Promise.resolve(held);
  }

  const pending = inFlight.get(key);
  if (pending) {
    return pending;
  }

  const made = queue.then(() => render(ask)).catch(() => null).then((bitmap) => {
    inFlight.delete(key);
    if (bitmap) {
      cache.put(key, bitmap);
    }
    return bitmap;
  });
  queue = made.catch(() => null);
  inFlight.set(key, made);
  return made;
}
