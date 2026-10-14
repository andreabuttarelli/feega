import type { MotionDoc } from './doc';
import type { OpResult } from './timeline';

export enum DocMode {
  Video = 'video',
  Still = 'still'
}

export function docMode(doc: Pick<MotionDoc, 'still'>): DocMode {
  return doc.still ? DocMode.Still : DocMode.Video;
}

export function stillFrame(doc: Pick<MotionDoc, 'still'>): number | null {
  return doc.still?.frame ?? null;
}

export function stillSeconds(doc: Pick<MotionDoc, 'still' | 'fps'>): number | null {
  return doc.still ? doc.still.frame / doc.fps : null;
}

export function setStill(doc: MotionDoc, seconds: number | null): OpResult {
  if (seconds === null) {
    const { still: _video, ...video } = doc;
    return { ok: true, doc: video };
  }
  if (!Number.isFinite(seconds) || seconds < 0) {
    return { ok: false, error: 'the still is a time in seconds, 0 or more' };
  }
  const frame = Math.min(Math.round(seconds * doc.fps), doc.durationInFrames - 1);
  return { ok: true, doc: { ...doc, still: { frame } } };
}
