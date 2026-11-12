import type { Viewport } from '$lib/canvas/dot-grid';
import type { Screen } from '$lib/canvas/gpu/camera';
import { ItemKind, type Item } from '@feega/motion-core/motion/gpu-full/display-list';
import type { PutFrame } from './screen-uses';
import { textured } from './texture-budget';

export type HeldFrame = PutFrame & { bytes: number };

const RGBA_BYTES = 4;
export const CACHE_SHARE = 0.5;

const bytesOfList = new WeakMap<readonly Item[], number>();

const summed = (items: readonly Item[]): number => items.reduce((sum, i) => sum + (i.kind === ItemKind.Image ? i.size.width * i.size.height * RGBA_BYTES : 0), 0);

export function pictureBytes(items: readonly Item[]): number {
  const known = bytesOfList.get(items);
  if (known !== undefined) {
    return known;
  }
  const bytes = summed(items);
  bytesOfList.set(items, bytes);
  return bytes;
}

const CACHE_STEPS_PER_OCTAVE = 4;

export const cacheZoom = (zoom: number): number => 2 ** (Math.ceil(Math.log2(zoom) * CACHE_STEPS_PER_OCTAVE) / CACHE_STEPS_PER_OCTAVE);

export enum ZoomPicture {
  Exact = 'exact',
  Held = 'held'
}

export const movingWhileZooming = (frames: readonly HeldFrame[], moving: ReadonlySet<string>, picture: ZoomPicture): ReadonlySet<string> => (picture === ZoomPicture.Held ? new Set(frames.map((f) => f.id)) : moving);

export enum Offscreen {
  Resident = 'resident',
  Dropped = 'dropped'
}

export function resident(frames: readonly HeldFrame[], view: Viewport, screen: Screen, budget: number, offscreen = Offscreen.Resident): HeldFrame[] {
  const seen = textured(frames.map((f) => ({ id: f.id, ...f.box, bytes: f.bytes })), view, screen, budget);
  const media = new Set(seen);
  if (offscreen === Offscreen.Dropped) {
    return frames.filter((f) => f.bytes === 0 || media.has(f.id));
  }
  let spent = frames.filter((f) => media.has(f.id)).reduce((sum, f) => sum + f.bytes, 0);
  const centre = { x: (screen.width / 2 - view.x) / view.zoom, y: (screen.height / 2 - view.y) / view.zoom };
  const distance = (f: HeldFrame) => Math.hypot(f.box.x + f.box.w / 2 - centre.x, f.box.y + f.box.h / 2 - centre.y);
  const beyond = frames.filter((f) => f.bytes > 0 && !media.has(f.id)).sort((a, b) => distance(a) - distance(b));
  for (const f of beyond) {
    if (spent + f.bytes > budget) {
      continue;
    }
    spent += f.bytes;
    media.add(f.id);
  }
  return frames.filter((f) => f.bytes === 0 || media.has(f.id));
}

const textureBytes = (f: HeldFrame, zoom: number) => Math.ceil(f.box.w * zoom) * Math.ceil(f.box.h * zoom) * RGBA_BYTES;

export function cached(frames: readonly HeldFrame[], view: Viewport, screen: Screen, budget: number, zoom = view.zoom): HeldFrame[] {
  const fits = new Set(textured(frames.map((f) => ({ id: f.id, ...f.box, bytes: textureBytes(f, zoom) })), view, screen, budget * CACHE_SHARE));
  return frames.map((f) => ({ ...f, cache: fits.has(f.id) }));
}

export const uncached = (frames: readonly HeldFrame[]): HeldFrame[] => frames.map((f) => ({ ...f, cache: false }));

export const heldWhileEdited = (frames: readonly HeldFrame[], edited: ReadonlySet<string>): HeldFrame[] => frames.map((f) => (edited.has(f.id) ? { ...f, cache: true, hold: true } : f));

export const heldWhileMoving = (frames: readonly HeldFrame[], moving: ReadonlySet<string>): HeldFrame[] => heldWhileEdited(frames, moving.size ? new Set(frames.map((f) => f.id)) : moving);
