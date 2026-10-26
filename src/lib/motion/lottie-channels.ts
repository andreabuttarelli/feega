import { Ease } from '@feega/motion-core/motion/design';
import { Interp, TRANSFORM, type Keyframe, type TransformKey, type Transform } from '@feega/motion-core/motion/keyframes';
import { easeOf, isAnimated, keysOf, valueAt, type Bezier4, type LottieProp } from './lottie-prop';

export const CHANNEL_KEYS = ['x', 'y', 'rotateZ', 'scaleX', 'scaleY', 'opacity'] as const satisfies readonly TransformKey[];

export type ChannelKey = (typeof CHANNEL_KEYS)[number];

export type Channel = { still: number } | { keys: Keyframe[] };

export type Channels = Partial<Record<ChannelKey, Channel>>;

export type Span = { start: number; end: number };

const DIGITS = 10000;
const FLAT_EASE = '0,0,1,1';
const HANDLE_Y = { min: -2, max: 3 };
const SAMPLE_TOLERANCE: Record<ChannelKey, number> = { x: 0.0005, y: 0.0005, rotateZ: 0.05, scaleX: 0.002, scaleY: 0.002, opacity: 0.004 };
const FULL_TURN = 360;

const round = (n: number) => Math.round(n * DIGITS) / DIGITS;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const fitted = (key: ChannelKey, n: number) => round(clamp(Number.isFinite(n) ? n : TRANSFORM[key].fallback, TRANSFORM[key].min, TRANSFORM[key].max));

function easeSpec(ease: Bezier4): Keyframe['ease'] {
  if (ease.join() === FLAT_EASE) {
    return Ease.Linear;
  }
  return [clamp(ease[0], 0, 1), clamp(ease[1], HANDLE_Y.min, HANDLE_Y.max), clamp(ease[2], 0, 1), clamp(ease[3], HANDLE_Y.min, HANDLE_Y.max)];
}

export function trackChannel(key: ChannelKey, prop: LottieProp | undefined, index: number, span: Span, convert: (v: number) => number): Channel | null {
  const dim = prop?.s ? [prop.x, prop.y, prop.z][index] : prop;
  if (!dim) {
    return null;
  }
  const at = prop?.s ? 0 : index;
  const value = (t: number) => fitted(key, convert(valueAt(dim, t)[at] ?? 0));
  if (!isAnimated(dim)) {
    return { still: value(span.start) };
  }
  const all = keysOf(dim) ?? [];
  const inside = all.filter((k) => k.t > span.start && k.t <= span.end).map((k) => k.t);
  const beyond = all.find((k) => k.t > span.end);
  const times = [span.start, ...inside, ...(beyond ? [beyond.t] : [])];
  const keys = times.map((t): Keyframe => {
    const source = all.findLast((k) => k.t <= t);
    return {
      frame: t - span.start,
      value: value(t),
      ease: source ? easeSpec(easeOf(source)) : Ease.Linear,
      ...(source?.h === 1 ? { out: Interp.Hold } : {})
    };
  });
  if (keys.every((k) => k.value === keys[0].value)) {
    return { still: keys[0].value as number };
  }
  return { keys };
}

function kept(values: readonly number[], tolerance: number): number[] {
  const last = values.length - 1;
  const chosen = new Set([0, last]);
  const spans: [number, number][] = [[0, last]];
  while (spans.length) {
    const [lo, hi] = spans.pop()!;
    let worst = -1;
    let deviation = tolerance;
    for (let m = lo + 1; m < hi; m++) {
      const line = values[lo] + ((values[hi] - values[lo]) * (m - lo)) / (hi - lo);
      if (Math.abs(values[m] - line) > deviation) {
        deviation = Math.abs(values[m] - line);
        worst = m;
      }
    }
    if (worst >= 0) {
      chosen.add(worst);
      spans.push([lo, worst], [worst, hi]);
    }
  }
  return [...chosen].sort((a, b) => a - b);
}

export function sampledChannel(key: ChannelKey, frames: readonly number[], values: readonly number[]): Channel {
  const clean = values.map((v) => fitted(key, v));
  if (clean.every((v) => v === clean[0])) {
    return { still: clean[0] };
  }
  const picks = kept(clean, SAMPLE_TOLERANCE[key]);
  return { keys: picks.map((i): Keyframe => ({ frame: frames[i], value: clean[i], ease: Ease.Linear })) };
}

export function unwrapped(angles: readonly number[]): number[] {
  const out: number[] = [];
  for (const angle of angles) {
    const previous = out.at(-1);
    out.push(previous === undefined ? angle : angle + FULL_TURN * Math.round((previous - angle) / FULL_TURN));
  }
  return out;
}

export function applied(channels: Channels): { transform: Transform; keyframes: Record<string, Keyframe[]> } {
  const transform: Transform = {};
  const keyframes: Record<string, Keyframe[]> = {};
  for (const key of CHANNEL_KEYS) {
    const channel = channels[key];
    if (!channel) {
      continue;
    }
    if ('keys' in channel) {
      keyframes[key] = channel.keys;
      continue;
    }
    if (channel.still !== TRANSFORM[key].fallback) {
      transform[key] = channel.still;
    }
  }
  return { transform, keyframes };
}
