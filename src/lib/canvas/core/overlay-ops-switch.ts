const PARAM = 'overlayOps';
const ON = '1';
const OFF = '0';
const BY_DEFAULT = true;

export const OVERLAY_OPS_STORAGE_KEY = 'feega:overlayOps';

export function overlayOpsOn(search: string, stored: string | null): boolean {
  const params = new URLSearchParams(search);
  if (params.has(PARAM)) {
    return params.get(PARAM) === ON;
  }
  if (stored === ON || stored === OFF) {
    return stored === ON;
  }
  return BY_DEFAULT;
}

export function storedOverlayOps(): string | null {
  try {
    return localStorage.getItem(OVERLAY_OPS_STORAGE_KEY);
  } catch {
    return null;
  }
}
