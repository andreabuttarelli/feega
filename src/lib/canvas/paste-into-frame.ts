export type SelectedTile = { id: string; takesDrops: boolean };

export function pasteIntoFrame(selected: readonly SelectedTile[], freeIds: readonly string[]): string | null {
  const only = selected.length === 1 ? selected[0] : null;
  if (!only?.takesDrops || !freeIds.length || freeIds.includes(only.id)) {
    return null;
  }

  return only.id;
}
