import { TrackKind } from '../components';
import type { MotionDoc } from '../doc';
import { Ease } from '../design';
import { setExpression } from '../expression/ops';
import type { Spring } from '../spring';
import { addClip, addTrack, moveTrack, setKeyframes, type OpResult } from '../timeline';

export enum Lens {
  Glass = 'LiquidGlass'
}

const TRACK_NAME: Record<Lens, string> = { [Lens.Glass]: 'Glass' };

export type GlassStop = { time: number; x: number; y: number };

export type GlassInput = {
  from: number;
  durationInFrames: number;
  props: Record<string, unknown>;
  path: GlassStop[];
  spring: Spring;
  fadeIn: number;
  fadeOut: number;
};

const TOP = 0;
const DIGITS = 10000;
const tidy = (n: number) => Math.round(n * DIGITS) / DIGITS;

type Step = (doc: MotionDoc) => OpResult;

function springSource(path: GlassStop[], axis: 'x' | 'y', spring: Spring): string {
  const keys = path.map((s) => `[${tidy(s.time)}, ${tidy(s[axis])}]`).join(', ');
  return `spring([${keys}], time, ${spring.stiffness}, ${spring.damping})`;
}

function presenceKeys(input: GlassInput) {
  const end = input.durationInFrames;
  const keys = [
    ...(input.fadeIn > 0 ? [{ frame: 0, value: 0 }] : []),
    { frame: input.fadeIn, value: 1 },
    { frame: end - input.fadeOut, value: 1 },
    ...(input.fadeOut > 0 ? [{ frame: end, value: 0 }] : [])
  ];
  return keys.map((k) => ({ ...k, ease: Ease.Standard }));
}

function steps(lens: Lens, input: GlassInput, ids: { clip: string; track: string }): Step[] {
  const first = input.path[0];
  const placed = first ? { centerX: first.x, centerY: first.y } : {};
  const glide: Step[] =
    input.path.length > 1
      ? (['x', 'y'] as const).map((axis) => (doc: MotionDoc) => setExpression(doc, ids.clip, axis === 'x' ? 'centerX' : 'centerY', springSource(input.path, axis, input.spring)))
      : [];
  const fade: Step[] = input.fadeIn > 0 || input.fadeOut > 0 ? [(doc) => setKeyframes(doc, ids.clip, 'presence', presenceKeys(input))] : [];
  return [
    (doc) => addTrack(doc, TrackKind.Visual, ids.track, TRACK_NAME[lens]),
    (doc) => moveTrack(doc, ids.track, TOP),
    (doc) => addClip(doc, { component: lens, from: input.from, durationInFrames: input.durationInFrames, trackId: ids.track, props: { ...input.props, ...placed } }, ids.clip),
    ...glide,
    ...fade
  ];
}

export function addLens(doc: MotionDoc, lens: Lens, input: GlassInput, ids: { clip: string; track: string }): OpResult {
  let result: OpResult = { ok: true, doc };
  for (const step of steps(lens, input, ids)) {
    if (!result.ok) {
      return result;
    }
    result = step(result.doc);
  }
  return result;
}
