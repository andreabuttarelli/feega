import { measureGaps, type Rect } from '$lib/motion/measure-gaps';
import type { Gap } from '$lib/motion/scene-select';

export type TileRect = { id: string; x: number; y: number; w: number; h: number };

const rectOf = (t: TileRect): Rect => ({ left: t.x, top: t.y, right: t.x + t.w, bottom: t.y + t.h });

function around(tiles: readonly TileRect[]): Rect {
  const rects = tiles.map(rectOf);
  return {
    left: Math.min(...rects.map((r) => r.left)),
    top: Math.min(...rects.map((r) => r.top)),
    right: Math.max(...rects.map((r) => r.right)),
    bottom: Math.max(...rects.map((r) => r.bottom))
  };
}

export function tileGaps(selected: readonly TileRect[], hovered: TileRect): Gap[] {
  if (!selected.length || selected.some((t) => t.id === hovered.id)) {
    return [];
  }
  return measureGaps(around(selected), rectOf(hovered));
}
