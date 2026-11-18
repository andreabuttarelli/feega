export enum Landing {
  Imported = 'imported',
  Restored = 'restored'
}

const UNNAMED_FRAME = 'Untitled frame';

export const frameName = (displayName: string | null | undefined): string => displayName || UNNAMED_FRAME;

export function unlandedNotice(landing: Landing, names: string[]): string | null {
  if (!names.length) {
    return null;
  }
  const frames = names.length === 1 ? 'frame' : 'frames';
  return `${names.length} ${frames} could not be ${landing}: ${names.join(', ')}`;
}
