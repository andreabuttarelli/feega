import type { Range } from './number-field';

export type Box = { width: number; height: number };

const MAX_ROUNDNESS = 0.5;
const RADIUS_STEP = 1;

const sideOf = (box: Box) => Math.min(box.width, box.height);

export const radiusShown = (roundness: number, box: Box) => Math.round(roundness * sideOf(box));

export function radiusStored(px: number, box: Box): number {
  const side = sideOf(box);
  return side > 0 ? Math.min(MAX_ROUNDNESS, Math.max(0, px / side)) : 0;
}

export const radiusRange = (box: Box): Range => ({ min: 0, max: Math.floor(sideOf(box) * MAX_ROUNDNESS), step: RADIUS_STEP });
