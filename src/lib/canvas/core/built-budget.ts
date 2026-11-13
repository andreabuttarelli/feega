import type { DisplayList, Item } from '@feega/motion-core/motion/gpu-full/display-list';
import type { Viewport } from '$lib/canvas/dot-grid';
import type { Box } from './canvas-scene';
import { inView } from './placeholders';

type Screen = { width: number; height: number };

export const ITEM_BYTES = 64 * 1024;

const itemsIn = (items: readonly Item[]): number => items.reduce((n, i) => n + 1 + itemsIn((i as { items?: Item[] }).items ?? []) + itemsIn(i.matte?.items ?? []), 0);

export const heldBytes = (list: Pick<DisplayList, 'items'>): number => itemsIn(list.items) * ITEM_BYTES;

export type Built = { id: string; box: Box; bytes: number };

export function overBudget(built: readonly Built[], view: Viewport, screen: Screen, budget: number): string[] {
  let total = built.reduce((sum, b) => sum + b.bytes, 0);
  const seen = new Set(inView(built, view, screen).map((b) => b.id));
  const centre = { x: (screen.width / 2 - view.x) / view.zoom, y: (screen.height / 2 - view.y) / view.zoom };
  const distance = (b: Box) => Math.hypot(b.x + b.w / 2 - centre.x, b.y + b.h / 2 - centre.y);
  const farthestFirst = built.filter((b) => !seen.has(b.id)).sort((a, b) => distance(b.box) - distance(a.box));

  const out: string[] = [];
  for (const b of farthestFirst) {
    if (total <= budget) {
      break;
    }
    out.push(b.id);
    total -= b.bytes;
  }
  return out;
}
