import type { CanvasBox } from '$lib/motion/draw-create';
import { MediaKind, kindOfFile } from '$lib/motion/media/pick';
import { tileChromeOf } from './motion-node';

type Holder = { id: string; type: string; data: Record<string, unknown>; x: number; y: number; w: number; h: number };

export type FrameHold = { nodeId: string; at: { x: number; y: number } };

export function frameHolding(tiles: readonly Holder[], box: CanvasBox): FrameHold | null {
  const centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  const holds = (t: Holder) => t.type === 'motion' && tileChromeOf(t).takesDrops && centre.x >= t.x && centre.x <= t.x + t.w && centre.y >= t.y && centre.y <= t.y + t.h;
  const frame = tiles.findLast(holds);
  return frame ? { nodeId: frame.id, at: { x: (centre.x - frame.x) / frame.w, y: (centre.y - frame.y) / frame.h } } : null;
}

export function groupHolding(tiles: readonly Holder[], boxes: readonly CanvasBox[]): FrameHold | null {
  const left = Math.min(...boxes.map((b) => b.left));
  const top = Math.min(...boxes.map((b) => b.top));
  const right = Math.max(...boxes.map((b) => b.left + b.width));
  const bottom = Math.max(...boxes.map((b) => b.top + b.height));
  return frameHolding(tiles, { left, top, width: right - left, height: bottom - top });
}

export function fileHolding(tiles: readonly Holder[], mimeType: string, at: { x: number; y: number }): FrameHold | null {
  if (kindOfFile(mimeType) !== MediaKind.Image) {
    return null;
  }

  return frameHolding(tiles, { left: at.x, top: at.y, width: 0, height: 0 });
}
