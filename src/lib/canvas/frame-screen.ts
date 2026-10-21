import type { Viewport } from '$lib/canvas/dot-grid';

export type FrameBox = { x: number; y: number; w: number; h: number; bar: number };
export type ScreenRect = { left: number; top: number; width: number; height: number };
export type DocSize = { width: number; height: number };
type Pt = [number, number];

export function frameScreenRect(view: Viewport, frame: FrameBox): ScreenRect {
  return {
    left: view.x + frame.x * view.zoom,
    top: view.y + (frame.y + frame.bar) * view.zoom,
    width: frame.w * view.zoom,
    height: (frame.h - frame.bar) * view.zoom
  };
}

export function frameScreenMap(view: Viewport, frame: FrameBox, doc: DocSize) {
  const rect = frameScreenRect(view, frame);
  const sx = rect.width / doc.width;
  const sy = rect.height / doc.height;
  return {
    toScreen: ([x, y]: Pt): Pt => [rect.left + x * sx, rect.top + y * sy],
    toDoc: ([x, y]: Pt): Pt => [(x - rect.left) / sx, (y - rect.top) / sy]
  };
}
