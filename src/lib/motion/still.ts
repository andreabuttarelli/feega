import { Background, DocMode, RESOLUTION_PROBLEM, docMode, fitsResolution, type MotionDoc } from './doc';
import { setCanvas, type OpResult } from './timeline';
import { timelineFits } from './editor-mount';

export const ANIMATE_SECONDS = 5;

export { DocMode, docMode };

export function stillFrame(doc: Pick<MotionDoc, 'still'>): number | null {
  return doc.still?.frame ?? null;
}

export function coverFrame(doc: Pick<MotionDoc, 'still' | 'durationInFrames'>): number {
  return stillFrame(doc) ?? Math.floor(doc.durationInFrames / 2);
}

export function stillSeconds(doc: Pick<MotionDoc, 'still' | 'fps'>): number | null {
  return doc.still ? doc.still.frame / doc.fps : null;
}

export function setStill(doc: MotionDoc, seconds: number | null): OpResult {
  if (seconds === null) {
    const { still: _video, ...video } = doc;
    if (!fitsResolution(video)) {
      return { ok: false, error: `${doc.width}×${doc.height} cannot become a video: ${RESOLUTION_PROBLEM}` };
    }
    return { ok: true, doc: video };
  }
  if (!Number.isFinite(seconds) || seconds < 0) {
    return { ok: false, error: 'the still is a time in seconds, 0 or more' };
  }
  const frame = Math.min(Math.round(seconds * doc.fps), doc.durationInFrames - 1);
  return { ok: true, doc: { ...doc, still: { frame } } };
}

const DESIGN_LOOK: Record<DocMode, (doc: MotionDoc) => MotionDoc> = {
  [DocMode.Video]: (doc) => (doc.background === Background.Brand ? { ...doc, background: Background.Transparent } : doc),
  [DocMode.Still]: (doc) => doc
};

export function designStill(doc: MotionDoc, seconds: number): OpResult {
  const pinned = setStill(doc, seconds);
  return pinned.ok ? { ok: true, doc: DESIGN_LOOK[docMode(doc)](pinned.doc) } : pinned;
}

export function animateStill(doc: MotionDoc, seconds = ANIMATE_SECONDS): OpResult {
  if (timelineFits(doc)) {
    return { ok: true, doc };
  }
  const end = doc.durationInFrames;
  const durationInFrames = Math.round(seconds * doc.fps);
  const stretched = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.from + c.durationInFrames >= end ? { ...c, durationInFrames: durationInFrames - c.from } : c)) })) };
  const sized = setCanvas(stretched, { durationInFrames });
  return sized.ok ? setStill(sized.doc, null) : sized;
}

export function settledStill(doc: MotionDoc): MotionDoc {
  const ends = doc.tracks.flatMap((t) => t.clips.map((c) => c.from + c.durationInFrames - 1));
  const frame = Math.max(0, Math.min(doc.durationInFrames - 1, ...(ends.length ? ends : [0])));
  return doc.still ? { ...doc, still: { frame } } : doc;
}
