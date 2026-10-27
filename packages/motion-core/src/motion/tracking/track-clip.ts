import { Ease } from '../design';
import { findClip, type MotionClip, type MotionDoc } from '../doc';
import type { Keyframe } from '../keyframes';
import { sourceSeconds } from '../time-remap';
import { setKeyframes, type OpResult } from '../timeline';
import type { Luma } from './luma';
import { DEFAULT_TRACK, Direction, trackFrom, type Spot, type TrackOptions } from './point-tracker';

export type LumaReader = (seconds: number[]) => Promise<Luma[]>;

export type TrackPoint = Spot & { frame: number; score: number };

export type ClipTrack = { clipId: string; anchor: number; points: TrackPoint[]; lost: boolean };

export type FrameRange = { from: number; to: number };

export type TrackRequest = { clipId: string; frame: number; point: Spot; range: FrameRange; options?: Partial<TrackOptions> };

export type TrackOutcome = { ok: true; track: ClipTrack } | { ok: false; error: string };

export const MAX_TRACK_FRAMES = 900;

const VIDEO = 'Video';
const KEY_PRECISION = 1e4;

const fail = (error: string) => ({ ok: false as const, error });

const rounded = (value: number) => Math.round(value * KEY_PRECISION) / KEY_PRECISION;

function videoClip(doc: MotionDoc, clipId: string): MotionClip | string {
  const found = findClip(doc, clipId);
  if (!found) {
    return `no clip ${clipId}`;
  }
  return found.clip.component === VIDEO ? found.clip : `${clipId} is a ${found.clip.component}: tracking is for Video clips`;
}

export async function trackClip(doc: MotionDoc, request: TrackRequest, read: LumaReader): Promise<TrackOutcome> {
  const clip = videoClip(doc, request.clipId);
  if (typeof clip === 'string') {
    return fail(clip);
  }
  const last = clip.durationInFrames - 1;
  if (request.frame < 0 || request.frame > last) {
    return fail(`frame ${request.frame} is outside ${request.clipId} (0 to ${last})`);
  }
  const from = Math.max(0, Math.min(request.range.from, request.frame));
  const to = Math.min(last, Math.max(request.range.to, request.frame));
  if (to - from + 1 > MAX_TRACK_FRAMES) {
    return fail(`track at most ${MAX_TRACK_FRAMES} frames at a time`);
  }

  const locals = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const lumas = await read(locals.map((local) => sourceSeconds(clip, local, doc.fps)));
  if (lumas.length !== locals.length) {
    return fail('the video could not be read for those frames');
  }

  const options = { ...DEFAULT_TRACK, ...request.options };
  const start = request.frame - from;
  const forward = trackFrom(lumas, start, request.point, Direction.Forward, options);
  const backward = trackFrom(lumas, start, request.point, Direction.Backward, options);
  if (!forward.samples.length) {
    return fail('the point is too close to the edge for that feature size');
  }
  const samples = [...backward.samples.slice(1).reverse(), ...forward.samples];

  return {
    ok: true,
    track: {
      clipId: request.clipId,
      anchor: request.frame,
      lost: forward.lost || backward.lost,
      points: samples.map((s) => ({ frame: from + s.index, x: s.x, y: s.y, score: s.score }))
    }
  };
}

export enum ApplyMode {
  Follow = 'follow',
  Stabilise = 'stabilise'
}

export type ApplyTrack = { targetClipId: string; mode: ApplyMode; offset: Spot };

type Shift = (point: TrackPoint) => Spot;

const FRAME_CENTRE = 0.5;

const SHIFT: Record<ApplyMode, (anchor: TrackPoint) => Shift> = {
  [ApplyMode.Follow]: () => (p) => ({ x: p.x - FRAME_CENTRE, y: p.y - FRAME_CENTRE }),
  [ApplyMode.Stabilise]: (anchor) => (p) => ({ x: anchor.x - p.x, y: anchor.y - p.y })
};

function spliced(track: readonly Keyframe[], fresh: Keyframe[]): Keyframe[] {
  const first = fresh[0].frame;
  const last = fresh[fresh.length - 1].frame;
  return [...track.filter((k) => k.frame < first || k.frame > last), ...fresh].sort((a, b) => a.frame - b.frame);
}

export function applyTrack(doc: MotionDoc, track: ClipTrack, apply: ApplyTrack): OpResult {
  const source = findClip(doc, track.clipId);
  const target = findClip(doc, apply.targetClipId);
  if (!source) {
    return fail(`no clip ${track.clipId}`);
  }
  if (!target) {
    return fail(`no clip ${apply.targetClipId}`);
  }
  const anchor = track.points.find((p) => p.frame === track.anchor) ?? track.points[0];
  if (!anchor) {
    return fail('the track has no points');
  }

  const shift = SHIFT[apply.mode](anchor);
  const at = (p: TrackPoint) => source.clip.from + p.frame - target.clip.from;
  const kept = track.points.filter((p) => at(p) >= 0 && at(p) < target.clip.durationInFrames);
  if (!kept.length) {
    return fail(`the track lies outside ${apply.targetClipId}`);
  }

  const keys = (axis: keyof Spot, size: number) => kept.map((p): Keyframe => ({ frame: at(p), value: rounded(shift(p)[axis] + apply.offset[axis] / size), ease: Ease.Linear }));
  const x = setKeyframes(doc, apply.targetClipId, 'x', spliced(target.clip.keyframes.x ?? [], keys('x', doc.width)));
  if (!x.ok) {
    return x;
  }
  const targetNow = findClip(x.doc, apply.targetClipId)!.clip;
  return setKeyframes(x.doc, apply.targetClipId, 'y', spliced(targetNow.keyframes.y ?? [], keys('y', doc.height)));
}
