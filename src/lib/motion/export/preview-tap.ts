import type { FrameSource } from './browser-render';

export type TapPace = { everyMs: number; now: () => number };

export const PREVIEW_EVERY_MS = 250;

export function tapFrames(source: FrameSource, show: (bitmap: ImageBitmap) => void, pace: TapPace): FrameSource {
  let last = Number.NEGATIVE_INFINITY;

  return (times, size, onFrame, signal) => source(times, size, (bitmap, index) => {
    const at = pace.now();
    if (at - last >= pace.everyMs) {
      last = at;
      show(bitmap);
    }
    return onFrame(bitmap, index);
  }, signal);
}

export function drawOn(canvas: HTMLCanvasElement | null) {
  return (bitmap: ImageBitmap) => {
    if (!canvas) {
      return;
    }
    if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
    }
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  };
}
