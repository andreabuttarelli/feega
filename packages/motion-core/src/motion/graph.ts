import { EASE_BEZIER, sampleTrack, type Bezier, type EaseSpec, type Keyframe } from './keyframes';

export enum GraphMode {
  Value = 'value',
  Speed = 'speed'
}

export enum KeyEnd {
  Out = 'out',
  In = 'in'
}

export type GraphPoint = { frame: number; value: number };
export type Handles = { outInfluence: number; outSpeed: number; inInfluence: number; inSpeed: number };

const ORDINATE = { min: -2, max: 3 };
const SPEED_STEP = 0.01;
const FLAT_SPAN = 10;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function bezierOf(ease: EaseSpec): Bezier {
  return typeof ease === 'string' ? EASE_BEZIER[ease] : ease;
}

function segment(a: Keyframe, b: Keyframe) {
  return { dt: b.frame - a.frame, dv: Number(b.value) - Number(a.value), va: Number(a.value) };
}

export function easeHandles(a: Keyframe, b: Keyframe, fps: number): Handles {
  const [x1, y1, x2, y2] = bezierOf(a.ease);
  const { dt, dv } = segment(a, b);
  const perSecond = (dv / dt) * fps;
  return {
    outInfluence: x1,
    outSpeed: x1 > 0 ? (y1 / x1) * perSecond : 0,
    inInfluence: 1 - x2,
    inSpeed: x2 < 1 ? ((1 - y2) / (1 - x2)) * perSecond : 0
  };
}

export function withHandles(h: Handles, a: Keyframe, b: Keyframe, fps: number): Bezier {
  const { dt, dv } = segment(a, b);
  const rise = (speed: number, influence: number) => (dv === 0 ? 0 : (speed * influence * dt) / (dv * fps));
  const x1 = clamp(h.outInfluence, 0, 1);
  const x2 = clamp(1 - h.inInfluence, 0, 1);
  return [x1, clamp(rise(h.outSpeed, x1), ORDINATE.min, ORDINATE.max), x2, clamp(1 - rise(h.inSpeed, 1 - x2), ORDINATE.min, ORDINATE.max)];
}

export function handlePoints(a: Keyframe, b: Keyframe): Record<KeyEnd, GraphPoint> {
  const [x1, y1, x2, y2] = bezierOf(a.ease);
  const { dt, dv, va } = segment(a, b);
  return {
    [KeyEnd.Out]: { frame: a.frame + x1 * dt, value: va + y1 * dv },
    [KeyEnd.In]: { frame: a.frame + x2 * dt, value: va + y2 * dv }
  };
}

const DRAG: Record<GraphMode, (a: Keyframe, b: Keyframe, end: KeyEnd, at: GraphPoint, fps: number) => Bezier> = {
  [GraphMode.Value]: (a, b, end, at) => {
    const [x1, y1, x2, y2] = bezierOf(a.ease);
    const { dt, dv, va } = segment(a, b);
    const x = clamp((at.frame - a.frame) / dt, 0, 1);
    const y = dv === 0 ? (end === KeyEnd.Out ? y1 : y2) : clamp((at.value - va) / dv, ORDINATE.min, ORDINATE.max);
    return end === KeyEnd.Out ? [x, y, x2, y2] : [x1, y1, x, y];
  },
  [GraphMode.Speed]: (a, b, end, at, fps) => {
    const h = easeHandles(a, b, fps);
    const dt = b.frame - a.frame;
    const next =
      end === KeyEnd.Out
        ? { ...h, outInfluence: clamp((at.frame - a.frame) / dt, 0, 1), outSpeed: at.value }
        : { ...h, inInfluence: clamp((b.frame - at.frame) / dt, 0, 1), inSpeed: at.value };
    return withHandles(next, a, b, fps);
  }
};

export function dragHandle(a: Keyframe, b: Keyframe, end: KeyEnd, at: GraphPoint, mode: GraphMode, fps: number): Bezier {
  return DRAG[mode](a, b, end, at, fps);
}

export enum Around {
  Keyframe = 'keyframe',
  Segment = 'segment'
}

export enum EasePreset {
  EasyEase = 'easy-ease',
  EasyEaseIn = 'easy-ease-in',
  EasyEaseOut = 'easy-ease-out',
  AppleDefault = 'apple-default',
  AppleEaseIn = 'apple-ease-in',
  AppleEaseOut = 'apple-ease-out',
  AppleEaseInOut = 'apple-ease-in-out'
}

export enum Half {
  Leaving = 'leaving',
  Entering = 'entering'
}

const THIRD = 1 / 3;
const EASY: Bezier = [THIRD, 0, 2 * THIRD, 1];
const BOTH = [Half.Leaving, Half.Entering];

export const EASE_PRESETS: Record<EasePreset, { label: string; halves: Half[]; around: Around; bezier: Bezier }> = {
  [EasePreset.EasyEase]: { label: 'Easy ease (F9)', halves: BOTH, around: Around.Keyframe, bezier: EASY },
  [EasePreset.EasyEaseIn]: { label: 'Easy ease in (⇧F9)', halves: [Half.Entering], around: Around.Keyframe, bezier: EASY },
  [EasePreset.EasyEaseOut]: { label: 'Easy ease out (⌘⇧F9)', halves: [Half.Leaving], around: Around.Keyframe, bezier: EASY },
  [EasePreset.AppleDefault]: { label: 'Apple default', halves: BOTH, around: Around.Segment, bezier: [0.25, 0.1, 0.25, 1] },
  [EasePreset.AppleEaseIn]: { label: 'Apple ease in', halves: BOTH, around: Around.Segment, bezier: [0.42, 0, 1, 1] },
  [EasePreset.AppleEaseOut]: { label: 'Apple ease out', halves: BOTH, around: Around.Segment, bezier: [0, 0, 0.58, 1] },
  [EasePreset.AppleEaseInOut]: { label: 'Apple ease in-out', halves: BOTH, around: Around.Segment, bezier: [0.42, 0, 0.58, 1] }
};

export const EASE_PRESET_IDS = Object.values(EasePreset) as [EasePreset, ...EasePreset[]];

const HALF: Record<Half, (current: Bezier, preset: Bezier) => Bezier> = {
  [Half.Leaving]: (current, preset) => [preset[0], preset[1], current[2], current[3]],
  [Half.Entering]: (current, preset) => [current[0], current[1], preset[2], preset[3]]
};

export function withHalf(half: Half, current: EaseSpec, preset: Bezier): Bezier {
  return HALF[half](bezierOf(current), preset);
}

export function presetEase(preset: EasePreset, current: EaseSpec): Bezier {
  const spec = EASE_PRESETS[preset];
  return spec.halves.reduce<Bezier>((ease, half) => withHalf(half, ease, spec.bezier), bezierOf(current));
}

const CURVE: Record<GraphMode, (track: Keyframe[], frame: number, fps: number) => number> = {
  [GraphMode.Value]: (track, frame) => sampleTrack(track, frame),
  [GraphMode.Speed]: (track, frame, fps) => ((sampleTrack(track, frame + SPEED_STEP) - sampleTrack(track, frame - SPEED_STEP)) / (2 * SPEED_STEP)) * fps
};

export function curvePoints(track: Keyframe[], mode: GraphMode, fps: number, steps: number): GraphPoint[] {
  const first = track[0].frame;
  const span = track[track.length - 1].frame - first;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const frame = first + (span * i) / steps;
    return { frame, value: CURVE[mode](track, frame, fps) };
  });
}

export type GraphView = { frames: [number, number]; values: [number, number] };

function padded(values: number[], pad: number): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const margin = (max - min || FLAT_SPAN) * pad;
  return [min - margin, max + margin];
}

export function fitView(points: readonly GraphPoint[], pad: number): GraphView {
  return { frames: padded(points.map((p) => p.frame), pad), values: padded(points.map((p) => p.value), pad) };
}
