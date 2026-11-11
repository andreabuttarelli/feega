export const TILES_BY_DEFAULT = true;

const PARAM = 'coreTiles';
const OFF = '0';

export const TILES_STORAGE_KEY = 'feega:coreTiles';

export function tilesOn(search: string, stored: string | null): boolean {
  const params = new URLSearchParams(search);
  if (params.has(PARAM)) {
    return params.get(PARAM) !== OFF;
  }
  if (stored !== null) {
    return stored !== OFF;
  }
  return TILES_BY_DEFAULT;
}

export function storedTiles(): string | null {
  try {
    return localStorage.getItem(TILES_STORAGE_KEY);
  } catch {
    return null;
  }
}
