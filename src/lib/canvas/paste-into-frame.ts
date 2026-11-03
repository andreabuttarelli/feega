export type SelectedTile = { id: string; takesDrops: boolean };

export function pasteTargets(selected: readonly SelectedTile[], freeIds: readonly string[]): string[] {
  if (!freeIds.length) {
    return [];
  }

  return selected.filter((tile) => tile.takesDrops && !freeIds.includes(tile.id)).map((tile) => tile.id);
}

export enum ElementPaste {
  AtPoint = 'at-point',
  IntoFrames = 'into-frames'
}

export function elementPaste(frames: readonly string[], frameUnderPointer: string | null): ElementPaste {
  const pointedIntoTheOne = frames.length === 1 && frames[0] === frameUnderPointer;
  return frames.length && !pointedIntoTheOne ? ElementPaste.IntoFrames : ElementPaste.AtPoint;
}
