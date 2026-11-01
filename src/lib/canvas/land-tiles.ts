export function landTiles<T extends { id: string }>(tiles: readonly T[], landed: readonly T[]): T[] {
  const ids = new Set(landed.map((t) => t.id));
  return [...tiles.filter((t) => !ids.has(t.id)), ...landed];
}
