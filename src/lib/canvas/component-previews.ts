import { FullBackend } from '@feega/motion-core/motion/gpu-full/backends';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { FrameDoc } from '$lib/canvas/core/frame-build';
import { frameOfLive } from '$lib/canvas/core/frame-source';
import { BUDGET, currentDevice } from '$lib/canvas/gpu/memory-budget';
import { idbShelf, type Shelf } from '$lib/canvas/outbox';
import { Freshness, Tone, fitInTile, framedDoc, freshness, inkBounds, padded, previewCache, previewDoc, previewKey, previewSide, shownBox, toneOf, type StoredMark } from './component-preview';
import type { Crop } from '$lib/motion/export-vector';
import type { StillRaster } from '$lib/motion/gpu-full/core-export';

export type PreviewAsk = { projectId: string; canvasId: string; frameId: string; compId: string; revision: number };

export type Preview = { bitmap: ImageBitmap; tone: Tone; width: number; height: number; close: () => void };

type Stored = StoredMark & { image: Blob; tone: Tone };

const BUDGET_SHARE = 32;
const PROBE_SCALE = 2;
const PADDING = 0.08;
const FRAMES_KEPT = 4;
const SHELF_PLACE = { db: 'feega-component-previews', store: 'previews' };
const IMAGE_TYPE = 'image/webp';
const TRIED = [FullBackend.Core, FullBackend.CoreGl];
const RASTER_IDLE_MS = 10_000;

const device = currentDevice();
const cache = previewCache<Preview>(BUDGET[device].textureBytes / BUDGET_SHARE);
const frames = new Map<string, Promise<FrameDoc | null>>();
let shelf: Shelf | null = null;
let queue: Promise<unknown> = Promise.resolve();
let raster: Promise<StillRaster | null> | null = null;
let idle: ReturnType<typeof setTimeout> | undefined;

const side = () => previewSide(device, devicePixelRatio);

const sourceUrl = (ask: PreviewAsk) => `/p/${encodeURIComponent(ask.projectId)}/c/${encodeURIComponent(ask.canvasId)}/motion/${encodeURIComponent(ask.frameId)}/source?revision=${ask.revision}`;

const storeKey = (ask: PreviewAsk) => `${ask.frameId}:${ask.compId}:${side()}`;

function shelfOf(): Shelf | null {
  try {
    shelf ??= idbShelf(indexedDB, SHELF_PLACE);
  } catch {
    return null;
  }
  return shelf;
}

function frameOf(ask: PreviewAsk): Promise<FrameDoc | null> {
  const key = `${ask.frameId}@${ask.revision}`;
  const held = frames.get(key);
  if (held) {
    return held;
  }
  const asked = fetch(sourceUrl(ask))
    .then((res) => (res.ok ? (res.json() as Promise<FrameDoc>) : null))
    .catch(() => null);
  frames.set(key, asked);
  for (const oldest of frames.keys()) {
    if (frames.size <= FRAMES_KEPT) {
      break;
    }
    frames.delete(oldest);
  }
  return asked;
}

async function fingerprint(doc: MotionDoc, frame: FrameDoc): Promise<string> {
  const tokens = { ...frame.tokens, logoUrl: frame.tokens.logoUrl?.split('?')[0] ?? null };
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(JSON.stringify([doc, tokens, side()])));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const previewOf = (bitmap: ImageBitmap, tone: Tone): Preview => ({ bitmap, tone, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() });

async function decoded(stored: Stored): Promise<Preview | null> {
  const bitmap = await createImageBitmap(stored.image).catch(() => null);
  return bitmap ? previewOf(bitmap, stored.tone) : null;
}

async function encoded(preview: Preview): Promise<Blob> {
  const canvas = new OffscreenCanvas(preview.width, preview.height);
  canvas.getContext('2d')!.drawImage(preview.bitmap, 0, 0);
  return canvas.convertToBlob({ type: IMAGE_TYPE });
}

function probe(shot: ImageBitmap): { ink: Crop; tone: Tone } {
  const context = new OffscreenCanvas(shot.width, shot.height).getContext('2d', { willReadFrequently: true })!;
  context.drawImage(shot, 0, 0);
  const { data } = context.getImageData(0, 0, shot.width, shot.height);
  const found = inkBounds(data, shot.width, shot.height);
  return { ink: found ? padded(found, PADDING) : { left: 0, top: 0, width: shot.width, height: shot.height }, tone: toneOf(data) };
}

async function rasterOf(): Promise<StillRaster | null> {
  clearTimeout(idle);
  raster ??= (async () => {
    const { stillRaster } = await import('$lib/motion/gpu-full/core-export');
    for (const backend of TRIED) {
      const made = await stillRaster(backend, side() * PROBE_SCALE);
      if (made) {
        return made;
      }
    }
    return null;
  })();
  return raster;
}

function releaseWhenIdle() {
  clearTimeout(idle);
  idle = setTimeout(() => {
    void raster?.then((r) => r?.dispose());
    raster = null;
  }, RASTER_IDLE_MS);
}

async function drawn(frame: FrameDoc, doc: MotionDoc): Promise<Preview | null> {
  const [{ prepare, drawFrame, textBoxesAt }, { loadFonts }, { smoothingOf }] = await Promise.all([import('@feega/motion-core/motion/gpu-full/display-list'), import('@feega/motion-core/motion/gpu-full/text/load'), import('@feega/motion-core/motion/gpu-full/text/painter')]);
  const options = { fonts: await loadFonts(doc, frame.assets, frame.tokens), smoothing: smoothingOf(navigator.userAgent) };
  const still = frameOfLive({ doc });
  const whole = prepare(doc, frame.tokens, frame.assets, options);
  const crop = shownBox(drawFrame(whole, still), textBoxesAt(whole, still));
  const core = crop ? await rasterOf() : null;
  if (!crop || !core) {
    return null;
  }

  const tile = side();
  const framed = framedDoc(doc, crop, tile * PROBE_SCALE);
  const shot = await core.shoot(prepare(framed.doc, frame.tokens, frame.assets, options), still / doc.fps, framed).catch(() => null);
  if (!shot) {
    return null;
  }
  const { ink, tone } = probe(shot);
  const fit = fitInTile(ink, tile);
  const bitmap = await createImageBitmap(shot, Math.round(ink.left), Math.round(ink.top), Math.max(1, Math.round(ink.width)), Math.max(1, Math.round(ink.height)), { resizeWidth: Math.max(1, fit.width), resizeHeight: Math.max(1, fit.height), resizeQuality: 'high' });
  shot.close();
  return previewOf(bitmap, tone);
}

async function refreshed(ask: PreviewAsk, stored: Stored | undefined, shown: Preview | null): Promise<Preview | null> {
  const frame = await frameOf(ask);
  if (!frame) {
    return null;
  }
  const doc = previewDoc(frame.doc, ask.compId);
  const hash = await fingerprint(doc, frame);
  if (stored && shown && stored.hash === hash) {
    void shelfOf()?.write(storeKey(ask), { ...stored, revision: ask.revision }).catch(() => undefined);
    return shown;
  }

  const fresh = await drawn(frame, doc);
  if (fresh) {
    void encoded(fresh)
      .then((image) => shelfOf()?.write(storeKey(ask), { revision: ask.revision, hash, image, tone: fresh.tone } satisfies Stored))
      .catch(() => undefined);
  }
  return fresh;
}

function inTurn<T>(work: () => Promise<T>): Promise<T | null> {
  const turn = queue.then(work).catch(() => null).finally(releaseWhenIdle);
  queue = turn;
  return turn;
}

async function storedFor(ask: PreviewAsk): Promise<Stored | undefined> {
  const found = await shelfOf()?.read(storeKey(ask)).catch(() => undefined);
  return (found ?? undefined) as Stored | undefined;
}

export async function componentPreview(ask: PreviewAsk, show: (preview: Preview) => void): Promise<void> {
  const key = previewKey(ask.compId, ask.revision);
  const held = cache.get(key);
  if (held) {
    show(held);
    return;
  }

  const stored = await storedFor(ask);
  const shown = stored ? await decoded(stored) : null;
  if (shown) {
    show(shown);
  }
  if (shown && freshness(stored, ask.revision) === Freshness.Current) {
    cache.put(key, shown);
    return;
  }

  const fresh = await inTurn(() => refreshed(ask, stored, shown));
  if (!fresh) {
    shown?.close();
    return;
  }
  cache.put(key, fresh);
  if (fresh !== shown) {
    shown?.close();
    show(fresh);
  }
}
