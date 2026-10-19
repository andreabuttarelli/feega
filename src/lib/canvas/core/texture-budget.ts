import type { Viewport } from '$lib/canvas/dot-grid';
import { visibleIds, type Rect, type Screen } from '$lib/canvas/gpu/camera';

export type Textured = Rect & { bytes: number };

export function textured(items: readonly Textured[], view: Viewport, screen: Screen, budget: number): string[] {
  const seen = visibleIds(
    items.filter((i) => i.bytes > 0),
    view,
    screen
  );
  const byArea = items.filter((i) => seen.has(i.id)).sort((a, b) => b.w * b.h - a.w * a.h);
  const kept: string[] = [];
  let spent = 0;
  for (const item of byArea) {
    if (spent + item.bytes > budget) {
      continue;
    }
    spent += item.bytes;
    kept.push(item.id);
  }
  return kept;
}
