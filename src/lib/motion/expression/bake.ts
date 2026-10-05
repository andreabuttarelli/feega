import { CAMERA, CAMERA_LANE, baseValues, type CameraKey } from '../camera';
import { withParams } from '../custom/params';
import { Ease } from '../design';
import { clipsOf, type MotionClip, type MotionDoc } from '../doc';
import { ValueKind, animProp, baseValue, type Keyframe } from '../keyframes';
import { ExpressionError } from './language';
import type { AudioAnalysis } from '../audio-analysis';
import { audioPort } from './audio-port';
import { Evaluator, type InputSource, type LaneBook, type LaneData } from './evaluator';

export type { InputSource };

export type ExpressionFault = { clipId: string; key: string; error: string };

class DocBook implements LaneBook {
  private readonly byId: Map<string, MotionClip>;
  private readonly order: MotionClip[];

  constructor(private readonly doc: MotionDoc) {
    this.order = clipsOf(doc);
    this.byId = new Map(this.order.map((c) => [c.id, c]));
  }

  resolve(ref: string | number): string {
    const clip =
      typeof ref === 'number'
        ? this.order[ref - 1]
        : (this.byId.get(ref) ?? this.order.find((c) => c.props.name === ref || c.props.text === ref));
    if (!clip) {
      throw new ExpressionError(`no layer "${ref}"`);
    }
    return clip.id;
  }

  lane(id: string, key: string): LaneData {
    return id === CAMERA_LANE ? this.cameraLane(key) : this.clipLane(id, key);
  }

  private clipLane(id: string, key: string): LaneData {
    const clip = this.byId.get(id);
    if (!clip) {
      throw new ExpressionError(`no layer "${id}"`);
    }
    const animated = withParams(this.doc, clip);
    const prop = animProp(clip.component, key, animated.params);
    if (!prop || prop.kind !== ValueKind.Number) {
      throw new ExpressionError(`${id} has no number property "${key}"`);
    }
    return {
      id,
      key,
      range: { min: prop.min, max: prop.max, step: prop.step },
      from: clip.from,
      track: clip.keyframes[key] ?? [],
      base: Number(baseValue(animated, key)),
      source: clip.expressions[key],
      index: this.order.indexOf(clip) + 1
    };
  }

  private cameraLane(key: string): LaneData {
    const camera = this.doc.camera;
    if (!camera || !(key in CAMERA)) {
      throw new ExpressionError(`the camera has no "${key}"`);
    }
    const cameraKey = key as CameraKey;
    const range = CAMERA[cameraKey];
    return {
      id: CAMERA_LANE,
      key,
      range: { min: range.min, max: range.max, step: range.step },
      from: 0,
      track: camera.keyframes[cameraKey] ?? [],
      base: baseValues(camera)[cameraKey],
      source: camera.expressions[cameraKey],
      index: 0
    };
  }
}

export function docBook(doc: MotionDoc): LaneBook {
  return new DocBook(doc);
}

const docEvaluator = (doc: MotionDoc, analyses: Record<string, AudioAnalysis>, inputs?: InputSource) => new Evaluator(docBook(doc), doc.fps, (frame) => audioPort(doc, analyses, frame), inputs);

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
  const evaluator = docEvaluator(doc, analyses);
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
  return docEvaluator(doc, analyses).value(clipId, key, frame);
}

export type LiveEvaluator = Pick<Evaluator, 'value' | 'reset'>;

export function liveEvaluator(doc: MotionDoc, analyses: Record<string, AudioAnalysis>, inputs: InputSource): LiveEvaluator {
  return docEvaluator(doc, analyses, inputs);
}
