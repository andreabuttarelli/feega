type Tile = { id: string; w: number; h: number };

export function snapshotKey<T extends Tile>(t: T, data: Record<string, unknown>, thumbs: readonly string[]): string {
  return JSON.stringify([Math.round(t.w), Math.round(t.h), data, thumbs]);
}

export function nextSnapshot(tiles: readonly Tile[], keyOf: (id: string) => string, pictured: ReadonlyMap<string, string>, visible: ReadonlySet<string>, live: ReadonlySet<string>): string | null {
  const due = tiles.filter((t) => !live.has(t.id) && pictured.get(t.id) !== keyOf(t.id));
  return (due.find((t) => visible.has(t.id)) ?? due[0])?.id ?? null;
}
