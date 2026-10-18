type Placed = { id: string; x: number; y: number; w: number; h: number };

const contains = (t: Placed, p: { x: number; y: number }) => p.x >= t.x && p.x <= t.x + t.w && p.y >= t.y && p.y <= t.y + t.h;

export function tilesAt(tiles: readonly Placed[], p: { x: number; y: number }): string[] {
  return tiles
    .filter((t) => contains(t, p))
    .map((t) => t.id)
    .reverse();
}
