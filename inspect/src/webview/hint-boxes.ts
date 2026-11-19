import type { Pick } from '../messages';
import { Group, type Hint } from './controls';

export type Box = { x: number; y: number; w: number; h: number };

type Edge = (r: Pick['rect'], size: number) => Box;

const INSIDE: Record<string, Edge> = {
  top: (r, n) => ({ x: r.x, y: r.y, w: r.width, h: n }),
  bottom: (r, n) => ({ x: r.x, y: r.y + r.height - n, w: r.width, h: n }),
  left: (r, n) => ({ x: r.x, y: r.y, w: n, h: r.height }),
  right: (r, n) => ({ x: r.x + r.width - n, y: r.y, w: n, h: r.height })
};

const OUTSIDE: Record<string, Edge> = {
  top: (r, n) => ({ x: r.x, y: r.y - n, w: r.width, h: n }),
  bottom: (r, n) => ({ x: r.x, y: r.y + r.height, w: r.width, h: n }),
  left: (r, n) => ({ x: r.x - n, y: r.y, w: n, h: r.height }),
  right: (r, n) => ({ x: r.x + r.width, y: r.y, w: n, h: r.height })
};

const EDGES: Record<Group, Record<string, Edge> | null> = {
  [Group.Padding]: INSIDE,
  [Group.Margin]: OUTSIDE,
  [Group.Radius]: null
};

export function hintBoxes(pick: Pick, hint: Hint): Box[] {
  const edges = EDGES[hint.group];
  if (!edges) {
    return [];
  }
  return hint.sides
    .map((side) => ({ side, size: Math.abs(parseFloat(pick.styles[`${hint.group}-${side}`] ?? '0') || 0) }))
    .filter(({ side, size }) => size > 0 && edges[side])
    .map(({ side, size }) => edges[side](pick.rect, size));
}
