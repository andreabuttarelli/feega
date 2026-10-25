import type { Point } from './camera';

export type Sample = { t: number; x: number; y: number };

const RIPPLE_S = 0.55;

export function pointerAt(samples: Sample[], t: number, rest: Point): Point {
  if (!samples.length || t < samples[0].t) {
    return rest;
  }
  const next = samples.findIndex((s) => s.t > t);
  if (next === -1) {
    const last = samples[samples.length - 1];
    return { x: last.x, y: last.y };
  }
  const a = samples[next - 1];
  const b = samples[next];
  const p = (t - a.t) / (b.t - a.t);
  return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
}

export function rippleAt(presses: number[], t: number): number | null {
  const press = presses.find((at) => t >= at && t - at < RIPPLE_S);
  return press === undefined ? null : (t - press) / RIPPLE_S;
}
