import { Ease } from '../design';
import { Interp, sampleTrack, type Bezier, type Keyframe } from '../keyframes';

export enum EaseKind {
  Bezier = 'bezier',
  Linear = 'linear',
  Hold = 'hold',
  Sampled = 'sampled'
}

export type CodeEase = { kind: EaseKind.Bezier; points: Bezier } | { kind: EaseKind.Linear } | { kind: EaseKind.Hold } | { kind: EaseKind.Sampled; stops: number[] };

const STOPS = 40;
const DECIMALS = 1000;

export const round = (n: number) => Math.round(n * DECIMALS) / DECIMALS;

export const LINEAR: CodeEase = { kind: EaseKind.Linear };

function sampled(a: Keyframe, b: Keyframe): CodeEase {
  const track = [
    { ...a, frame: 0, value: 0 },
    { ...b, frame: STOPS, value: 1 }
  ];
  return { kind: EaseKind.Sampled, stops: Array.from({ length: STOPS + 1 }, (_, i) => round(sampleTrack(track, i))) };
}

export function easeBetween(a: Keyframe, b: Keyframe): CodeEase {
  const out = a.out ?? Interp.Bezier;
  const into = b.in ?? Interp.Bezier;
  if (out === Interp.Hold || into === Interp.Hold) {
    return { kind: EaseKind.Hold };
  }
  if (out !== Interp.Bezier || into !== Interp.Bezier || a.roving || b.roving) {
    return out === Interp.Linear && into === Interp.Linear ? LINEAR : sampled(a, b);
  }
  if (Array.isArray(a.ease)) {
    return { kind: EaseKind.Bezier, points: a.ease.map(round) as Bezier };
  }
  return a.ease === Ease.Linear ? LINEAR : sampled(a, b);
}

const CSS: { [K in EaseKind]: (e: Extract<CodeEase, { kind: K }>) => string } = {
  [EaseKind.Bezier]: (e) => `cubic-bezier(${e.points.join(', ')})`,
  [EaseKind.Linear]: () => 'linear',
  [EaseKind.Hold]: () => 'step-end',
  [EaseKind.Sampled]: (e) => `linear(${e.stops.join(', ')})`
};

export const cssEase = (e: CodeEase): string => (CSS[e.kind] as (e: CodeEase) => string)(e);
