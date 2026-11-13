import type { Viewport } from './dot-grid';
import { endedUncleanly } from './gpu/crash-record';

const KEY_PREFIX = 'feega:viewport:';

const keyOf = (userId: string, canvasId: string) => `${KEY_PREFIX}${userId}:${canvasId}`;

function parse(raw: string | null): Viewport | null {
  const v = raw ? JSON.parse(raw) : null;

  return v && typeof v.x === 'number' && typeof v.y === 'number' && typeof v.zoom === 'number' ? { x: v.x, y: v.y, zoom: v.zoom } : null;
}

let diedInView: boolean | undefined;

export const pageDiedInView = (): boolean => (diedInView ??= endedUncleanly(localStorage));

export function loadViewport(userId: string, canvasId: string): Viewport | null {
  try {
    return pageDiedInView() ? null : parse(localStorage.getItem(keyOf(userId, canvasId)));
  } catch {
    return null;
  }
}

export function rememberViewport(userId: string, canvasId: string, view: Viewport): void {
  try {
    localStorage.setItem(keyOf(userId, canvasId), JSON.stringify(view));
  } catch {
    return;
  }
}
