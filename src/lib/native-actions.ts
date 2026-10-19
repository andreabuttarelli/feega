import { nativeBridge, type ShareItem } from './native-bridge';
import { nativeKeys } from './native-keys';

export function haptic(ms: number): void {
  const tap = nativeBridge(globalThis, nativeKeys())?.haptic;
  if (tap) {
    tap();
    return;
  }
  navigator.vibrate?.(ms);
}

export function systemShare(): ((item: ShareItem) => Promise<void>) | null {
  return nativeBridge(globalThis, nativeKeys())?.share ?? null;
}
