import { ItemKind, type DisplayList } from '@feega/motion-core/motion/gpu-full/display-list';
import { BlendMode } from '@feega/motion-core/motion/blend';
import type { Viewport } from '$lib/canvas/dot-grid';
import type { Box } from './canvas-scene';

type Size = { width: number; height: number };
type Rect = { x: number; y: number; width: number; height: number };

const MIN_SIDE_PX = 16;
const MAX_SIDE_PX = 512;
const DB_NAME = 'feega-frame-thumbs';
const STORE = 'thumbs';
const THUMB_TYPE = 'image/webp';
const THUMB_QUALITY = 0.8;
const IDENTITY: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0];

export const thumbClip = (key: string) => `thumb:${key}`;

export const thumbList = (key: string, size: Size): DisplayList => ({
  ...size,
  background: null,
  unsupported: [],
  items: [{ kind: ItemKind.Image, clip: thumbClip(key), src: thumbClip(key), video: false, mediaTime: 0, size, fit: 'fill', focus: [0.5, 0.5], zoom: 1, clipped: true, inner: IDENTITY, opacity: 1, matrix: IDENTITY, blur: 0, blend: BlendMode.Normal }]
});

export function thumbRect(box: Box, view: Viewport, area: Size, resolution: number): Rect | null {
  const x = (box.x * view.zoom + view.x) * resolution;
  const y = (box.y * view.zoom + view.y) * resolution;
  const width = box.w * view.zoom * resolution;
  const height = box.h * view.zoom * resolution;
  const inside = x >= 0 && y >= 0 && x + width <= area.width * resolution && y + height <= area.height * resolution;
  if (!inside || Math.min(width, height) < MIN_SIDE_PX) {
    return null;
  }
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

export function thumbSize(rect: Rect): Size {
  const scale = Math.min(1, MAX_SIDE_PX / Math.max(rect.width, rect.height));
  return { width: Math.max(1, Math.round(rect.width * scale)), height: Math.max(1, Math.round(rect.height * scale)) };
}

export async function grabThumb(canvas: HTMLCanvasElement, rect: Rect): Promise<Blob | null> {
  const size = thumbSize(rect);
  const out = new OffscreenCanvas(size.width, size.height);
  out.getContext('2d')?.drawImage(canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, out.width, out.height);
  return out.convertToBlob({ type: THUMB_TYPE, quality: THUMB_QUALITY }).catch(() => null);
}

export type ThumbStore = { get: (key: string) => Promise<Blob | null>; put: (key: string, blob: Blob) => void };

const NO_STORE: ThumbStore = { get: async () => null, put: () => {} };

const request = <T>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => Object.assign(r, { onsuccess: () => resolve(r.result), onerror: () => reject(r.error) }));

export function thumbStore(): ThumbStore {
  if (typeof indexedDB === 'undefined') {
    return NO_STORE;
  }
  const opening = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const open = indexedDB.open(DB_NAME, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  const store = async (mode: IDBTransactionMode) => (await opening)?.transaction(STORE, mode).objectStore(STORE) ?? null;
  return {
    get: async (key) => {
      const s = await store('readonly').catch(() => null);
      return s ? ((await request(s.get(key)).catch(() => null)) as Blob | null) ?? null : null;
    },
    put: (key, blob) => void store('readwrite').then((s) => s?.put(blob, key)).catch(() => undefined)
  };
}

type Shown = { id: string; group: string };
type Drawn = { id: string; key: string; group: string };

export function thumbsDue<T extends Drawn>(shown: readonly Shown[], frames: readonly T[], taken: ReadonlySet<string>): T[] {
  const byId = new Map(frames.map((f) => [f.id, f]));
  return shown.flatMap((layer) => {
    const f = byId.get(layer.id);
    return f && !taken.has(f.key) && layer.group === f.group ? [f] : [];
  });
}
