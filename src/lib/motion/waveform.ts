import { FPS } from './design';

export const PEAKS_PER_SECOND = FPS;

export function clipPeaks(peaks: readonly number[], clip: { trimStart: number; durationInFrames: number; fps: number }): number[] {
  const start = Math.round((clip.trimStart / clip.fps) * PEAKS_PER_SECOND);
  const count = Math.round((clip.durationInFrames / clip.fps) * PEAKS_PER_SECOND);
  return peaks.slice(start, start + count);
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export function wavePath(peaks: readonly number[]): string {
  return peaks.map((p, i) => `M${i} ${round((1 - p) / 2)}V${round((1 + p) / 2)}`).join('');
}
