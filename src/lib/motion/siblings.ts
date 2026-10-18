import type { MotionDoc } from './doc';

export enum Direction {
  Next = 1,
  Previous = -1
}

export function siblingOf(order: readonly string[], selected: readonly string[], direction: Direction): string | null {
  if (!order.length) {
    return null;
  }
  const from = Math.max(...selected.map((id) => order.indexOf(id)), -1);
  if (from < 0) {
    return order[direction === Direction.Next ? 0 : order.length - 1];
  }
  return order[(from + direction + order.length) % order.length];
}

export const layerOrder = (doc: MotionDoc): string[] => doc.tracks.flatMap((t) => [...t.clips].reverse().map((c) => c.id));
