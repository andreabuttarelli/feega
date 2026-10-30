import { Background, newClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { TrackKind } from '@feega/motion-core/motion/components';
import type { DisplayList, TextBox } from '@feega/motion-core/motion/gpu-full/display-list';
import { componentSlice } from '$lib/motion/canvas-components';
import { boundsOfClips } from '$lib/motion/export-svg';
import type { Crop } from '$lib/motion/export-vector';
import { BUDGET, Device } from './gpu/memory-budget';

const TILE_CSS_SIDE = 96;

export const previewKey = (compId: string, revision: number): string => `${compId}@${revision}`;

export const previewSide = (device: Device, dpr: number): number => Math.round(TILE_CSS_SIDE * Math.min(dpr, BUDGET[device].resolution));

const PREVIEW_HOST = 'preview';

export function previewDoc(frame: MotionDoc, compId: string): MotionDoc {
  const slice = componentSlice(frame, compId);
  const durationInFrames = slice.comps[compId]?.durationInFrames ?? frame.durationInFrames;
  const host = newClip({ id: PREVIEW_HOST, from: 0, durationInFrames, component: 'Precomp', props: { comp: compId } });
  return { ...slice, tracks: [{ id: PREVIEW_HOST, kind: TrackKind.Visual, name: PREVIEW_HOST, clips: [host] }], background: Background.Transparent };
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

const INK_ALPHA = 8;
const ALPHA = 3;

export function inkBounds(rgba: Uint8ClampedArray, width: number, height: number): Crop | null {
  let [left, top, right, bottom] = [width, height, -1, -1];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * RGBA_BYTES + ALPHA] < INK_ALPHA) {
        continue;
      }
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

export function padded(crop: Crop, share: number): Crop {
  const pad = Math.max(crop.width, crop.height) * share;
  return { left: crop.left - pad, top: crop.top - pad, width: crop.width + 2 * pad, height: crop.height + 2 * pad };
}

export enum Tone {
  Light = 'light',
  Dark = 'dark'
}

const LUMA = [0.2126, 0.7152, 0.0722];
const LIGHT_INK = 0.6;

export function toneOf(rgba: Uint8ClampedArray): Tone {
  let [sum, weight] = [0, 0];
  for (let i = 0; i < rgba.length; i += RGBA_BYTES) {
    const alpha = rgba[i + ALPHA] / 255;
    sum += alpha * LUMA.reduce((l, k, c) => l + (k * rgba[i + c]) / 255, 0);
    weight += alpha;
  }
  return weight && sum / weight > LIGHT_INK ? Tone.Dark : Tone.Light;
}

export type TileFit = { scale: number; width: number; height: number };

export function fitInTile(crop: Crop, side: number): TileFit {
  const scale = side / Math.max(crop.width, crop.height);
  return { scale, width: Math.round(crop.width * scale), height: Math.round(crop.height * scale) };
}
