import { Ease } from './design';
import { findClip, type MotionClip, type MotionDoc } from './doc';
import { REMAP_KEY, sampleTrack, type Keyframe } from './keyframes';
import { removeKeyframes, setKeyframes, setProps, type OpResult } from './timeline';

export { REMAP_KEY };

export const MIN_RATE = 0.1;
export const MAX_RATE = 10;
const SAME_STEP = 1e-6;
const RATE_PRECISION = 1e6;
const PLAIN_SPEED = 1;

export type MediaSegment = { at: number; duration: number; mediaStart: number; rate: number };

type Timed = Pick<MotionClip, 'from' | 'durationInFrames' | 'trimStart' | 'keyframes' | 'props'>;
type Playback = { speed?: number; reverse?: boolean };

const playback = (clip: Timed) => {
  const p = clip.props as Playback;
  return { speed: p.speed ?? PLAIN_SPEED, reverse: p.reverse ?? false };
};

export function isRemapped(clip: Timed): boolean {
  const { speed, reverse } = playback(clip);
  return speed !== PLAIN_SPEED || reverse || Boolean(clip.keyframes[REMAP_KEY]?.length);
}

export function sourceSeconds(clip: Timed, local: number, fps: number): number {
  const track = clip.keyframes[REMAP_KEY];
  if (track?.length) {
    return Math.max(0, sampleTrack(track, local));
  }
  const { speed, reverse } = playback(clip);
  const played = reverse ? clip.durationInFrames - 1 - local : local;
  return clip.trimStart / fps + (speed * played) / fps;
}

const playable = (rate: number) => rate >= MIN_RATE && rate <= MAX_RATE;

export function mediaSegments(clip: Timed, fps: number): MediaSegment[] {
  const sources = Array.from({ length: clip.durationInFrames }, (_, f) => sourceSeconds(clip, f, fps));
  const segments: MediaSegment[] = [];
  let start = 0;

  while (start < sources.length) {
    const step = start + 1 < sources.length ? sources[start + 1] - sources[start] : 1 / fps;
    const rate = Math.round(step * fps * RATE_PRECISION) / RATE_PRECISION;
    let end = start + 1;
    while (playable(rate) && end < sources.length && Math.abs(sources[end] - sources[end - 1] - step) < SAME_STEP) {
      end += 1;
    }
    segments.push({ at: (clip.from + start) / fps, duration: (end - start) / fps, mediaStart: sources[start], rate: playable(rate) ? rate : PLAIN_SPEED });
    start = end;
  }
  return segments;
}

export function remappedSegments(clip: Timed, fps: number): MediaSegment[] | null {
  return isRemapped(clip) ? mediaSegments(clip, fps) : null;
}

function videoOf(doc: MotionDoc, clipId: string): MotionClip | string {
  const found = findClip(doc, clipId);
  if (!found) {
    return `no clip ${clipId}`;
  }
  return found.clip.component === 'Video' ? (found.clip as MotionClip) : `${clipId} is a ${found.clip.component}: time remap is for Video clips`;
}

const linear = (frame: number, value: number): Keyframe => ({ frame, value, ease: Ease.Linear });

export function enableTimeRemap(doc: MotionDoc, clipId: string): OpResult {
  const clip = videoOf(doc, clipId);
  if (typeof clip === 'string') {
    return { ok: false, error: clip };
  }
  const last = clip.durationInFrames - 1;
  return setKeyframes(doc, clipId, REMAP_KEY, [linear(0, sourceSeconds(clip, 0, doc.fps)), linear(last, sourceSeconds(clip, last, doc.fps))]);
}

export function freezeFrame(doc: MotionDoc, clipId: string, frame: number): OpResult {
  const clip = videoOf(doc, clipId);
  if (typeof clip === 'string') {
    return { ok: false, error: clip };
  }
  const local = Math.min(Math.max(0, frame - clip.from), clip.durationInFrames - 1);
  return setKeyframes(doc, clipId, REMAP_KEY, [linear(local, sourceSeconds(clip, local, doc.fps))]);
}

export function clearTimeRemap(doc: MotionDoc, clipId: string): OpResult {
  const clip = videoOf(doc, clipId);
  if (typeof clip === 'string') {
    return { ok: false, error: clip };
  }
  const plain = setProps(doc, clipId, { speed: PLAIN_SPEED, reverse: false });
  return plain.ok ? removeKeyframes(plain.doc, clipId, REMAP_KEY) : plain;
}
