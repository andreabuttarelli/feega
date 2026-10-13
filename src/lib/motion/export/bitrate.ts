import { ExportFormat, FORMAT, QUALITY_SCALE, Quality } from '../export-formats';
import type { Size } from '../export-plan';

const DESCENDING: readonly Quality[] = [Quality.Max, Quality.High, Quality.Standard];
const BROWSER_H264_CEILING = 100_000_000;

export function videoBitrate(size: Size, fps: number, quality: Quality): number {
  return Math.min(BROWSER_H264_CEILING, Math.round(size.width * size.height * fps * FORMAT[ExportFormat.Mp4H264].bitsPerPixel * QUALITY_SCALE[quality]));
}

export function bitrateLadder(size: Size, fps: number, quality: Quality): number[] {
  const tiers = DESCENDING.slice(DESCENDING.indexOf(quality));
  return [...new Set(tiers.map((q) => videoBitrate(size, fps, q)))];
}
