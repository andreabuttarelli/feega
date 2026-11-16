const DIRECT_BY_DEFAULT = false;

const PARAM = 'directZoom';
const ON = '1';

export const DIRECT_STORAGE_KEY = 'feega:directZoom';

export function directOn(search: string, stored: string | null): boolean {
  const params = new URLSearchParams(search);
  if (params.has(PARAM)) {
    return params.get(PARAM) === ON;
  }
  if (stored !== null) {
    return stored === ON;
  }
  return DIRECT_BY_DEFAULT;
}

export function storedDirect(): string | null {
  try {
    return localStorage.getItem(DIRECT_STORAGE_KEY);
  } catch {
    return null;
  }
}
