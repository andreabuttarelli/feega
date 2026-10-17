import { Edge } from '$lib/motion/space';

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
