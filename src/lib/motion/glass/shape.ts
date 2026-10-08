import { PROFILE_PEAK, type GlassNumberKey } from './model';

const SECOND_MODE = 0.35;
const SECOND_RATIO = 1.7;
const SECOND_PHASE = 1;
const TAU = Math.PI * 2;

export type GlassValues = Record<GlassNumberKey, number>;

export type GlassPose = { cx: number; cy: number; rx: number; ry: number; bend: number; frost: number; alpha: number; tint: string; tintAmount: number; rim: number };

export type GlassSize = { width: number; height: number; fps: number };

export function glassShape(v: GlassValues, tint: string, frame: number, at: GlassSize): GlassPose {
  const radius = (v.diameter * Math.min(at.width, at.height)) / 2;
  const phase = TAU * v.wobbleSpeed * (frame / at.fps);
  const swell = v.wobble * (Math.sin(phase) + SECOND_MODE * Math.sin(SECOND_RATIO * phase + SECOND_PHASE));
  return {
    cx: v.centerX * at.width,
    cy: v.centerY * at.height,
    rx: radius * (1 + swell),
    ry: radius * (1 - swell),
    bend: 2 * PROFILE_PEAK * radius * v.refraction * v.presence,
    frost: v.frost * v.presence,
    alpha: v.presence,
    tint,
    tintAmount: v.tintAmount,
    rim: v.rim
  };
}
