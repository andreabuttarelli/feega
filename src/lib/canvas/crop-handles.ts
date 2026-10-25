import { FillType, ImageFit, WHOLE_PICTURE, type FillOf } from '$lib/motion/fill/model';
import { imageRect } from '$lib/motion/gpu-full/image-rect';
import { elementFills } from '$lib/motion/fill/elements';
import { findClip, type MotionDoc } from '$lib/motion/doc';
import { editsText } from './frame-text-edit';

export type Pt = [number, number];
export type Size = { width: number; height: number };
export type Window = { x: number; y: number; w: number; h: number };
export type Placement = { x: number; y: number; width: number; height: number };
type ImageFill = FillOf<FillType.Image>;

export enum Corner {
  TopLeft = 'top-left',
  TopRight = 'top-right',
  BottomRight = 'bottom-right',
  BottomLeft = 'bottom-left'
}

export const MIN_WINDOW = 0.05;

const clamp = (v: number, low: number, high: number) => Math.min(high, Math.max(low, v));

function inside(win: Window): Window {
  const w = clamp(win.w, MIN_WINDOW, 1);
  const h = clamp(win.h, MIN_WINDOW, 1);
  return { x: clamp(win.x, 0, 1 - w), y: clamp(win.y, 0, 1 - h), w, h };
}

const shownBy = (fit: ImageFit, fill: ImageFill, box: Size, natural: Size): Window => {
  const placed = imageRect(box, natural, fit, [fill.focus.x, fill.focus.y], fill.scale);
  return { x: -placed.x / placed.width, y: -placed.y / placed.height, w: box.width / placed.width, h: box.height / placed.height };
};

const START: Record<ImageFit, (fill: ImageFill, box: Size, natural: Size) => Window> = {
  [ImageFit.Cover]: (fill, box, natural) => shownBy(ImageFit.Cover, fill, box, natural),
  [ImageFit.Contain]: (fill, box, natural) => shownBy(ImageFit.Cover, { ...fill, scale: 1 }, box, natural),
  [ImageFit.Tile]: (fill, box, natural) => shownBy(ImageFit.Cover, { ...fill, scale: 1 }, box, natural),
  [ImageFit.Fill]: () => ({ ...WHOLE_PICTURE }),
  [ImageFit.Crop]: (fill) => ({ ...(fill.crop ?? WHOLE_PICTURE) })
};

export const windowOfFit = (fill: ImageFill, box: Size, natural: Size): Window => inside(START[fill.fit](fill, box, natural));

export const imagePlacement = (win: Window, box: Size): Placement => ({ x: (-win.x / win.w) * box.width, y: (-win.y / win.h) * box.height, width: box.width / win.w, height: box.height / win.h });

export const panned = (win: Window, box: Size, dx: number, dy: number): Window => inside({ ...win, x: win.x - (dx * win.w) / box.width, y: win.y - (dy * win.h) / box.height });

export function zoomedAt(win: Window, box: Size, anchor: Pt, wanted: number): Window {
  const scale = clamp(wanted, Math.max(win.w, win.h), Math.min(win.w, win.h) / MIN_WINDOW);
  const w = clamp(win.w / scale, MIN_WINDOW, 1);
  const h = clamp(win.h / scale, MIN_WINDOW, 1);
  const pointX = win.x + (anchor[0] / box.width) * win.w;
  const pointY = win.y + (anchor[1] / box.height) * win.h;
  return inside({ x: pointX - (anchor[0] / box.width) * w, y: pointY - (anchor[1] / box.height) * h, w, h });
}

const OPPOSITE: Record<Corner, (rect: Placement) => Pt> = {
  [Corner.TopLeft]: (r) => [r.x + r.width, r.y + r.height],
  [Corner.TopRight]: (r) => [r.x, r.y + r.height],
  [Corner.BottomRight]: (r) => [r.x, r.y],
  [Corner.BottomLeft]: (r) => [r.x + r.width, r.y]
};

export function cornerZoom(win: Window, box: Size, corner: Corner, pointer: Pt): Window {
  const rect = imagePlacement(win, box);
  const fixed = OPPOSITE[corner](rect);
  const scale = Math.max(Math.abs(pointer[0] - fixed[0]) / rect.width, Math.abs(pointer[1] - fixed[1]) / rect.height);
  return zoomedAt(win, box, fixed, scale);
}

export const appliedCrop = (fill: ImageFill, win: Window): ImageFill => ({ ...fill, fit: ImageFit.Crop, crop: { ...win } });

export function imageTarget(doc: MotionDoc, clipId: string): { index: number; fill: ImageFill } | null {
  const clip = findClip(doc, clipId)?.clip;
  if (!clip || editsText(doc, clipId)) {
    return null;
  }
  const fills = elementFills(clip.component, clip.props);
  const index = fills.findLastIndex((f) => f.visible && f.type === FillType.Image);
  return index < 0 ? null : { index, fill: fills[index] as ImageFill };
}
