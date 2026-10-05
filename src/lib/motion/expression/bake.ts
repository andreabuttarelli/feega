import { CAMERA, CAMERA_LANE, baseValues, type CameraKey } from '../camera';
import { withParams } from '../custom/params';
import { Ease } from '../design';
import { clipsOf, type MotionClip, type MotionDoc } from '../doc';
import { ValueKind, animProp, baseValue, sampleTrack, type AnimProp, type Keyframe } from '../keyframes';
import { ExpressionError, compileExpression, runExpression, type LayerHandle, type Program } from './language';
import type { AudioAnalysis } from '../audio-analysis';
import { audioPort } from './audio-port';
import { fallbackPort, type InputPort } from './inputs';

export type InputSource = (clipId: string, key: string, frame: number) => InputPort;

export type ExpressionFault = { clipId: string; key: string; error: string };

type Lane = { id: string; key: string; range: Pick<AnimProp, 'min' | 'max' | 'step'>; from: number; track: readonly Keyframe[]; keyed: (local: number) => number; source: string | undefined; index: number };

const MIN_TOLERANCE = 1e-4;
const TOLERANCE_PER_STEP = 0.01;

function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  }
  return h | 0;
}

const clamp = (v: number, range: Lane['range']) => Math.min(range.max, Math.max(range.min, v));

class Evaluator {
  private readonly byId: Map<string, MotionClip>;
  private readonly order: MotionClip[];
  private readonly programs = new Map<string, Program>();
  private readonly memo = new Map<string, number>();
  private readonly visiting: string[] = [];

  constructor(
    private readonly doc: MotionDoc,
    private readonly analyses: Record<string, AudioAnalysis> = {},
    private readonly inputs: InputSource = (_id, _key, frame) => fallbackPort(frame / doc.fps)
  ) {
    this.order = clipsOf(doc);
    this.byId = new Map(this.order.map((c) => [c.id, c]));
  }

  value(id: string, key: string, frame: number): number {
    const lane = this.lane(id, key);
    const local = frame - lane.from;
    const keyed = lane.keyed(local);
    if (!lane.source) {
      return keyed;
    }

    const name = `${id}.${key}`;
    const memoKey = `${name}@${frame}`;
    const known = this.memo.get(memoKey);
    if (known !== undefined) {
      return known;
    }
    const loop = this.visiting.indexOf(name);
    if (loop >= 0) {
      throw new ExpressionError(`expression cycle: ${[...this.visiting.slice(loop), name].join(' → ')}`);
    }

    this.visiting.push(name);
    try {
      const result = runExpression(this.program(name, lane.source), {
        time: local / this.doc.fps,
        frame: local,
        fps: this.doc.fps,
        value: keyed,
        index: lane.index,
        seed: seedOf(name),
        track: lane.track,
        thisLayer: this.handle(id, frame),
        layer: (ref) => this.handle(this.resolve(ref), frame),
        audio: audioPort(this.doc, this.analyses, frame),
        input: this.inputs(id, key, frame)
      });
      const clamped = clamp(result, lane.range);
      this.memo.set(memoKey, clamped);
      return clamped;
    } finally {
      this.visiting.pop();
    }
  }

  private program(name: string, source: string): Program {
    const cached = this.programs.get(name);
    if (cached) {
      return cached;
    }
    const compiled = compileExpression(source);
    if (!compiled.ok) {
      throw new ExpressionError(compiled.error);
    }
    this.programs.set(name, compiled.program);
    return compiled.program;
  }

  private handle(id: string, frame: number): LayerHandle {
    return { get: (key) => this.value(id, key, frame) };
  }

  private resolve(ref: string | number): string {
    const clip =
      typeof ref === 'number'
        ? this.order[ref - 1]
        : (this.byId.get(ref) ?? this.order.find((c) => c.props.name === ref || c.props.text === ref));
    if (!clip) {
      throw new ExpressionError(`no layer "${ref}"`);
    }
    return clip.id;
  }

  private lane(id: string, key: string): Lane {
    return id === CAMERA_LANE ? this.cameraLane(key) : this.clipLane(id, key);
  }

  private clipLane(id: string, key: string): Lane {
    const clip = this.byId.get(id);
    if (!clip) {
      throw new ExpressionError(`no layer "${id}"`);
    }
    const animated = withParams(this.doc, clip);
    const prop = animProp(clip.component, key, animated.params);
    if (!prop || prop.kind !== ValueKind.Number) {
      throw new ExpressionError(`${id} has no number property "${key}"`);
    }
    const track = clip.keyframes[key] ?? [];
    const base = Number(baseValue(animated, key));
    return {
      id,
      key,
      range: prop,
      from: clip.from,
      track,
      keyed: (local) => (track.length ? sampleTrack(track, local) : base),
      source: clip.expressions[key],
      index: this.order.indexOf(clip) + 1
    };
  }

  private cameraLane(key: string): Lane {
    const camera = this.doc.camera;
    if (!camera || !(key in CAMERA)) {
      throw new ExpressionError(`the camera has no "${key}"`);
    }
    const cameraKey = key as CameraKey;
    const track = camera.keyframes[cameraKey] ?? [];
    const base = baseValues(camera)[cameraKey];
    return {
      id: CAMERA_LANE,
      key,
      range: CAMERA[cameraKey],
      from: 0,
      track,
      keyed: (frame) => (track.length ? sampleTrack(track, frame) : base),
      source: camera.expressions[cameraKey],
      index: 0
    };
  }

  reset(): void {
    this.memo.clear();
  }

  tolerance(id: string, key: string): number {
    return Math.max(MIN_TOLERANCE, this.lane(id, key).range.step * TOLERANCE_PER_STEP);
  }
}

function deviates(samples: number[], from: number, to: number, tolerance: number): boolean {
  for (let i = from + 1; i < to; i++) {
    const expected = samples[from] + ((samples[to] - samples[from]) * (i - from)) / (to - from);
    if (Math.abs(samples[i] - expected) > tolerance) {
      return true;
    }
  }
  return false;
}

const PRECISION = 1e6;
const round = (n: number) => Math.round(n * PRECISION) / PRECISION;

function simplify(samples: number[], tolerance: number): Keyframe[] {
  const kept = [0];
  for (let i = 1; i < samples.length - 1; i++) {
    if (deviates(samples, kept[kept.length - 1], i + 1, tolerance)) {
      kept.push(i);
    }
  }
  if (samples.length > 1) {
    kept.push(samples.length - 1);
  }
  return kept.map((frame) => ({ frame, value: round(samples[frame]), ease: Ease.Linear }));
}

type Baked = { doc: MotionDoc; faults: ExpressionFault[] };

function sampleLane(evaluator: Evaluator, id: string, key: string, from: number, frames: number): Keyframe[] {
  const samples = Array.from({ length: frames + 1 }, (_, f) => evaluator.value(id, key, from + f));
  return simplify(samples, evaluator.tolerance(id, key));
}

function bakeLanes(evaluator: Evaluator, id: string, keys: string[], from: number, frames: number, faults: ExpressionFault[]): Record<string, Keyframe[]> {
  const baked: Record<string, Keyframe[]> = {};
  for (const key of keys) {
    try {
      baked[key] = sampleLane(evaluator, id, key, from, frames);
    } catch (e) {
      faults.push({ clipId: id, key, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return baked;
}

function hasExpressions(doc: MotionDoc): boolean {
  return Object.keys(doc.camera?.expressions ?? {}).length > 0 || clipsOf(doc).some((c) => Object.keys(c.expressions).length > 0);
}

function bake(doc: MotionDoc, analyses: Record<string, AudioAnalysis>): Baked {
  if (!hasExpressions(doc)) {
    return { doc, faults: [] };
  }
  const evaluator = new Evaluator(doc, analyses);
  const faults: ExpressionFault[] = [];

  const tracks = doc.tracks.map((t) => ({
    ...t,
    clips: t.clips.map((c) => {
      const keys = Object.keys(c.expressions);
      if (!keys.length) {
        return c;
      }
      return { ...c, keyframes: { ...c.keyframes, ...bakeLanes(evaluator, c.id, keys, c.from, c.durationInFrames, faults) }, expressions: {} };
    })
  }));
  const camera = doc.camera && {
    ...doc.camera,
    keyframes: { ...doc.camera.keyframes, ...bakeLanes(evaluator, CAMERA_LANE, Object.keys(doc.camera.expressions), 0, doc.durationInFrames, faults) },
    expressions: {}
  };

  return { doc: { ...doc, tracks, camera }, faults };
}

export function bakeExpressions(doc: MotionDoc, analyses: Record<string, AudioAnalysis> = {}): MotionDoc {
  return bake(doc, analyses).doc;
}

export function expressionErrors(doc: MotionDoc, analyses: Record<string, AudioAnalysis> = {}): ExpressionFault[] {
  return bake(doc, analyses).faults;
}

export function expressionValue(doc: MotionDoc, clipId: string, key: string, frame: number, analyses: Record<string, AudioAnalysis> = {}): number {
  return new Evaluator(doc, analyses).value(clipId, key, frame);
}

export type LiveEvaluator = Pick<Evaluator, 'value' | 'reset'>;

export function liveEvaluator(doc: MotionDoc, analyses: Record<string, AudioAnalysis>, inputs: InputSource): LiveEvaluator {
  return new Evaluator(doc, analyses, inputs);
}
