import { localStore } from '$lib/browser-storage';
import { parseViewport, type Viewport } from './viewport';

const keyOf = (frame: string) => `feega.playView.${frame}`;

export function readViewport(frame: string): Viewport {
  try {
    return parseViewport(localStore()?.getItem(keyOf(frame)) ?? null);
  } catch {
    return parseViewport(null);
  }
}

export function writeViewport(frame: string, view: Viewport) {
  try {
    localStore()?.setItem(keyOf(frame), JSON.stringify(view));
  } catch {
    return;
  }
}
