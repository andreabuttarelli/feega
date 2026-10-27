import { Axis, Edge } from '$lib/motion/space';
import { tidyMoves } from '$lib/motion/tidy';

export type TileBox = { id: string; x: number; y: number; width: number; height: number };
export type TileMove = { id: string; x: number; y: number };

type Bounds = { left: number; top: number; right: number; bottom: number };

const PLACE: Record<Edge, (t: TileBox, b: Bounds) => { x: number; y: number }> = {
  [Edge.Left]: (t, b) => ({ x: b.left, y: t.y }),
  [Edge.Center]: (t, b) => ({ x: (b.left + b.right) / 2 - t.width / 2, y: t.y }),
  [Edge.Right]: (t, b) => ({ x: b.right - t.width, y: t.y }),
  [Edge.Top]: (t, b) => ({ x: t.x, y: b.top }),
  [Edge.Middle]: (t, b) => ({ x: t.x, y: (b.top + b.bottom) / 2 - t.height / 2 }),
  [Edge.Bottom]: (t, b) => ({ x: t.x, y: b.bottom - t.height })
};

export function alignTiles(tiles: readonly TileBox[], edge: Edge): TileMove[] {
  if (tiles.length < 2) {
    return [];
  }
  const bounds: Bounds = {
    left: Math.min(...tiles.map((t) => t.x)),
    top: Math.min(...tiles.map((t) => t.y)),
    right: Math.max(...tiles.map((t) => t.x + t.width)),
    bottom: Math.max(...tiles.map((t) => t.y + t.height))
  };
  return tiles.map((t) => ({ id: t.id, ...PLACE[edge](t, bounds) })).filter((m, i) => m.x !== tiles[i].x || m.y !== tiles[i].y);
}

export function tidyTiles(tiles: readonly TileBox[]): TileMove[] {
  const at = new Map(tiles.map((t) => [t.id, t]));
  return tidyMoves(tiles.map((t) => ({ id: t.id, left: t.x, top: t.y, width: t.width, height: t.height }))).map((m) => ({ id: m.id, x: at.get(m.id)!.x + m.dx, y: at.get(m.id)!.y + m.dy }));
}

export const STACK_GAP = 24;

const span = (values: number[]) => Math.max(...values) - Math.min(...values);

export function stackTiles(tiles: readonly TileBox[], gap: number): TileMove[] {
  if (tiles.length < 2) {
    return [];
  }
  const across = span(tiles.map((t) => t.x + t.width / 2)) >= span(tiles.map((t) => t.y + t.height / 2));
  const left = Math.min(...tiles.map((t) => t.x));
  const top = Math.min(...tiles.map((t) => t.y));
  const ordered = [...tiles].sort((a, b) => (across ? a.x - b.x : a.y - b.y));
  let at = across ? left : top;
  return ordered.map((t) => {
    const move = across ? { id: t.id, x: at, y: top } : { id: t.id, x: left, y: at };
    at += (across ? t.width : t.height) + gap;
    return move;
  });
}

const MIN_DISTRIBUTED = 3;

export function distributeTiles(tiles: readonly TileBox[], axis: Axis): TileMove[] {
  if (tiles.length < MIN_DISTRIBUTED) {
    return [];
  }
  const across = axis === Axis.X;
  const start = (t: TileBox) => (across ? t.x : t.y);
  const size = (t: TileBox) => (across ? t.width : t.height);
  const ordered = [...tiles].sort((a, b) => start(a) - start(b));
  const last = ordered[ordered.length - 1];
  const free = start(last) + size(last) - start(ordered[0]) - ordered.reduce((sum, t) => sum + size(t), 0);
  const gap = free / (ordered.length - 1);
  let at = start(ordered[0]);

  return ordered
    .map((t) => {
      const move = across ? { id: t.id, x: at, y: t.y } : { id: t.id, x: t.x, y: at };
      at += size(t) + gap;
      return move;
    })
    .filter((m) => {
      const from = ordered.find((t) => t.id === m.id)!;
      return m.x !== from.x || m.y !== from.y;
    });
}
