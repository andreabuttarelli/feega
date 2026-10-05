import type { ComponentId } from './components';
import { clipsOf, type MotionDoc } from './doc';

export type CostSpan = { from: number; to: number; ms: number };

export const FLAT_FRAME_MS = 60;
const FULL_HD_PIXELS = 1920 * 1080;

const FRAME_MS: Partial<Record<ComponentId, number>> = {
  Device3D: 1600,
  Logo3D: 400,
  Text3D: 400,
  Model3D: 600,
  Shape3D: 300
};

export function costSpans(doc: MotionDoc, pixels = FULL_HD_PIXELS): CostSpan[] {
  return clipsOf(doc).flatMap((clip) => {
    const ms = FRAME_MS[clip.component];
    return ms ? [{ from: clip.from, to: clip.from + clip.durationInFrames, ms: (ms * pixels) / FULL_HD_PIXELS }] : [];
  });
}

export function frameCosts(totalFrames: number, spans: readonly CostSpan[]): number[] {
  const costs = Array.from({ length: totalFrames }, () => FLAT_FRAME_MS);
  for (const span of spans) {
    for (let f = Math.max(0, span.from); f < Math.min(totalFrames, span.to); f++) {
      costs[f] += span.ms;
    }
  }
  return costs;
}
