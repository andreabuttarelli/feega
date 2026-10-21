import type { CanvasBox } from '$lib/motion/draw-create';
import { tileChromeOf } from './motion-node';

type Holder = { id: string; type: string; data: Record<string, unknown>; x: number; y: number; w: number; h: number };

export type FrameHold = { nodeId: string; at: { x: number; y: number } };

export function frameHolding(tiles: readonly Holder[], box: CanvasBox): FrameHold | null {
  const centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  const holds = (t: Holder) => t.type === 'motion' && tileChromeOf(t).takesDrops && centre.x >= t.x && centre.x <= t.x + t.w && centre.y >= t.y && centre.y <= t.y + t.h;
  const frame = tiles.findLast(holds);
  return frame ? { nodeId: frame.id, at: { x: (centre.x - frame.x) / frame.w, y: (centre.y - frame.y) / frame.h } } : null;
}
