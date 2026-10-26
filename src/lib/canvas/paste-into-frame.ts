export type SelectedTile = { id: string; takesDrops: boolean };

export function pasteTargets(selected: readonly SelectedTile[], freeIds: readonly string[]): string[] {
  if (!freeIds.length) {
    return [];
  }

  return selected.filter((tile) => tile.takesDrops && !freeIds.includes(tile.id)).map((tile) => tile.id);
}
