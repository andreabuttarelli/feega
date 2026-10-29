import { Background, type MotionDoc } from '@feega/motion-core/motion/doc';
import type { DisplayList, TextBox } from '@feega/motion-core/motion/gpu-full/display-list';
import { componentSlice, mainClipOf } from '$lib/motion/canvas-components';
import { boundsOfClips } from '$lib/motion/export-svg';
import type { Crop } from '$lib/motion/export-vector';
import { BUDGET, Device } from './gpu/memory-budget';

const TILE_CSS_SIDE = 96;

export const previewKey = (compId: string, revision: number): string => `${compId}@${revision}`;

export const previewSide = (device: Device, dpr: number): number => Math.round(TILE_CSS_SIDE * Math.min(dpr, BUDGET[device].resolution));

export function previewDoc(frame: MotionDoc, compId: string): MotionDoc {
  const main = mainClipOf(frame, compId);
  const tracks = frame.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id === main) })).filter((t) => t.clips.length);
  return { ...componentSlice(frame, compId), tracks, background: Background.Transparent };
}

function union(boxes: readonly Crop[]): Crop | null {
  if (!boxes.length) {
    return null;
  }
  const left = Math.min(...boxes.map((b) => b.left));
  const top = Math.min(...boxes.map((b) => b.top));
  const right = Math.max(...boxes.map((b) => b.left + b.width));
  const bottom = Math.max(...boxes.map((b) => b.top + b.height));
  return { left, top, width: right - left, height: bottom - top };
}

export function shownBox(list: DisplayList, texts: Record<string, TextBox>): Crop | null {
  const painted = boundsOfClips(list, new Set(list.items.map((i) => i.clip)));
  const found = union([...(painted ? [painted] : []), ...Object.values(texts)].filter((b) => b.width > 0 && b.height > 0));
  if (!found) {
    return null;
  }
  const left = Math.max(0, found.left);
  const top = Math.max(0, found.top);
  return { left, top, width: Math.min(list.width, found.left + found.width) - left, height: Math.min(list.height, found.top + found.height) - top };
}

type Held = { width: number; height: number; close: () => void };

const RGBA_BYTES = 4;

const bytesOf = (b: Held) => b.width * b.height * RGBA_BYTES;

export function previewCache<T extends Held>(maxBytes: number) {
  const held = new Map<string, T>();
  let bytes = 0;

  function get(key: string): T | undefined {
    const found = held.get(key);
    if (!found) {
      return undefined;
    }
    held.delete(key);
    held.set(key, found);
    return found;
  }

  function put(key: string, bitmap: T) {
    held.set(key, bitmap);
    bytes += bytesOf(bitmap);
    for (const [oldest, kept] of held) {
      if (bytes <= maxBytes || oldest === key) {
        break;
      }
      held.delete(oldest);
      bytes -= bytesOf(kept);
      kept.close();
    }
  }

  return { get, put };
}

export type TileFit ={ scale: number; width: number; height: number };

export function fitInTile(crop: Crop, side: number): TileFit {
  const scale = side / Math.max(crop.width, crop.height);
  return { scale, width: Math.round(crop.width * scale), height: Math.round(crop.height * scale) };
}
