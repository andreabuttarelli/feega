import { TrackKind } from './components';
import { findClip, type MotionClip, type MotionDoc } from './doc';
import type { Keyframe, TransformKey } from './keyframes';
import { IDENTITY, decomposeLocal, invert2d, mul2d, parentProblem, pivotBox, pivotOf, transformAt, worldAt, type ParentOpacity, type Pose2d, type Size } from './parent';
import { addClip, setKeyframes, setTransform, type OpResult } from './timeline';

export enum KeepWorld {
  Yes = 'yes',
  No = 'no'
}

const fail = (error: string): OpResult => ({ ok: false, error });

const NULL_FRAMES = 150;
const PRECISION = 10000;
const round = (n: number) => Math.round(n * PRECISION) / PRECISION;

function withClip(doc: MotionDoc, clipId: string, edit: (clip: MotionClip) => MotionClip): MotionDoc {
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === clipId ? edit(c as MotionClip) : c)) })) };
}

export function addNull(doc: MotionDoc, input: { from: number; durationInFrames?: number; trackId?: string; x?: number; y?: number }, id: string): OpResult {
  return addClip(doc, { component: 'Null', from: input.from, durationInFrames: input.durationInFrames ?? NULL_FRAMES, trackId: input.trackId, props: { x: input.x ?? 0.5, y: input.y ?? 0.5 } }, id);
}

type Lane = { key: TransformKey; value: (pose: Pose2d, size: Size, scale: number) => number; shift: (key: Keyframe, now: number, next: number) => number };

const added = (k: Keyframe, now: number, next: number) => round(Number(k.value) + next - now);
const scaled = (k: Keyframe, now: number, next: number) => round(now ? (Number(k.value) * next) / now : next);

const POSE_LANES: Lane[] = [
  { key: 'x', value: (p, s) => p.x / s.width, shift: added },
  { key: 'y', value: (p, s) => p.y / s.height, shift: added },
  { key: 'rotateZ', value: (p) => p.rotateZ, shift: added },
  { key: 'scaleX', value: (p, _s, scale) => p.scaleX / scale, shift: scaled },
  { key: 'scaleY', value: (p, _s, scale) => p.scaleY / scale, shift: scaled }
];

const EPSILON = 1e-6;

function placeAt(doc: MotionDoc, clipId: string, pose: Pose2d, frame: number): OpResult {
  const clip = findClip(doc, clipId)!.clip;
  const size = { width: doc.width, height: doc.height };
  const scale = transformAt(clip, 'scale', frame);
  let result: OpResult = { ok: true, doc };

  for (const lane of POSE_LANES) {
    if (!result.ok) {
      return result;
    }
    const now = transformAt(clip, lane.key, frame);
    const next = lane.value(pose, size, scale);
    if (Math.abs(next - now) < EPSILON) {
      continue;
    }
    const track = clip.keyframes[lane.key];
    result = track?.length
      ? setKeyframes(result.doc, clipId, lane.key, track.map((k) => ({ ...k, value: lane.shift(k, now, next) })))
      : setTransform(result.doc, clipId, { [lane.key]: round(next) });
  }
  return result;
}

export function setParent(doc: MotionDoc, clipId: string, parentId: string | null, opts: { at?: number; keep?: KeepWorld } = {}): OpResult {
  const found = findClip(doc, clipId);
  if (!found) {
    return fail(`no clip ${clipId}`);
  }
  if (parentId && !findClip(doc, parentId)) {
    return fail(`no clip ${parentId} to parent to`);
  }

  const next = withClip(doc, clipId, (c) => ({ ...c, parent: parentId }));
  const problem = parentProblem(next);
  if (problem) {
    return fail(problem);
  }
  if ((opts.keep ?? KeepWorld.Yes) === KeepWorld.No) {
    return { ok: true, doc: next };
  }

  const frame = opts.at ?? found.clip.from;
  const size = { width: doc.width, height: doc.height };
  const world = worldAt(doc, clipId, frame, size);
  const parentWorld = parentId ? worldAt(next, parentId, frame, size) : IDENTITY;
  const local = mul2d(invert2d(parentWorld), world);
  return placeAt(next, clipId, decomposeLocal(local, pivotOf(found.clip, size)), frame);
}

export function setParentOpacity(doc: MotionDoc, clipId: string, parentOpacity: ParentOpacity): OpResult {
  return findClip(doc, clipId) ? { ok: true, doc: withClip(doc, clipId, (c) => ({ ...c, parentOpacity })) } : fail(`no clip ${clipId}`);
}

export function nullFromSelection(doc: MotionDoc, clipIds: readonly string[], frame: number, id: string): OpResult {
  const clips = clipIds.map((c) => findClip(doc, c)).filter((f) => f !== null);
  const visual = clips.filter((f) => f.track.kind === TrackKind.Visual);
  if (!visual.length) {
    return fail('select the visual clips the null should hold');
  }

  const size = { width: doc.width, height: doc.height };
  const boxes = visual.map((f) => pivotBox(f.clip.props, size));
  const left = Math.min(...boxes.map((b) => b.left));
  const right = Math.max(...boxes.map((b) => b.left + b.width));
  const top = Math.min(...boxes.map((b) => b.top));
  const bottom = Math.max(...boxes.map((b) => b.top + b.height));
  const from = Math.min(...visual.map((f) => f.clip.from));
  const end = Math.max(...visual.map((f) => f.clip.from + f.clip.durationInFrames));

  let result = addNull(doc, { from, durationInFrames: end - from, trackId: visual[0].track.id, x: round((left + right) / 2 / size.width), y: round((top + bottom) / 2 / size.height) }, id);
  for (const f of visual) {
    if (!result.ok) {
      return result;
    }
    result = setParent(result.doc, f.clip.id, id, { at: frame });
  }
  return result;
}
