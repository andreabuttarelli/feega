import { sampleColor, sampleTrack, type Keyframe } from '../keyframes';
import { GLASS_NUMBERS, GLASS_NUMBER_KEYS, GLASS_TINT, PROFILE_PEAK, type GlassNumberKey } from './model';

const SECOND_MODE = 0.35;
const SECOND_RATIO = 1.7;
const SECOND_PHASE = 1;
const TAU = Math.PI * 2;

export type GlassPose = { cx: number; cy: number; rx: number; ry: number; bend: number; frost: number; alpha: number; tint: string; tintAmount: number; rim: number };

type GlassClip = { props: Record<string, unknown>; keyframes: Record<string, Keyframe[] | undefined> };
type Frame = { width: number; height: number; fps: number };

const valueAt = (clip: GlassClip, key: GlassNumberKey, frame: number) => {
  const track = clip.keyframes[key];
  return track?.length ? sampleTrack(track, frame) : Number(clip.props[key] ?? GLASS_NUMBERS[key].fallback);
};

export function glassPose(clip: GlassClip, frame: number, at: Frame, resolve: (v: string) => string): GlassPose {
  const v = Object.fromEntries(GLASS_NUMBER_KEYS.map((key) => [key, valueAt(clip, key, frame)])) as Record<GlassNumberKey, number>;
  const radius = (v.diameter * Math.min(at.width, at.height)) / 2;
  const phase = TAU * v.wobbleSpeed * (frame / at.fps);
  const swell = v.wobble * (Math.sin(phase) + SECOND_MODE * Math.sin(SECOND_RATIO * phase + SECOND_PHASE));
  const track = clip.keyframes[GLASS_TINT.key];
  const tint = track?.length ? sampleColor(track, frame, resolve) : resolve(String(clip.props[GLASS_TINT.key] ?? GLASS_TINT.fallback));
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
