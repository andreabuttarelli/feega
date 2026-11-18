import { isBlankPixels } from './live-tiles.svelte';

const PROBE_PX = 64;

export async function isBlankImage(src: string): Promise<boolean> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  const loaded = await img.decode().then(
    () => true,
    () => false
  );
  if (!loaded) {
    return false;
  }

  const canvas = Object.assign(document.createElement('canvas'), { width: PROBE_PX, height: PROBE_PX });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return false;
  }
  ctx.drawImage(img, 0, 0, PROBE_PX, PROBE_PX);
  const pixels = (() => {
    try {
      return ctx.getImageData(0, 0, PROBE_PX, PROBE_PX);
    } catch {
      return null;
    }
  })();
  return pixels ? isBlankPixels(pixels) : false;
}
