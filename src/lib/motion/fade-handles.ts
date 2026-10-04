import type { ComponentId } from './components';
import { findClip, type MotionClip, type MotionDoc } from './doc';
import { setProps, type OpResult } from './timeline';

export enum FadeEdge {
  In = 'fadeIn',
  Out = 'fadeOut'
}

export type FadeHandle = { edge: FadeEdge; x: number };

const FADING: ReadonlySet<ComponentId> = new Set(['Audio', 'Video']);
const MAX_FADE_S = 5;
const TENTHS = 10;

type Fades = Partial<Record<FadeEdge, number>>;

export function fadeHandles(clip: MotionClip, fps: number, ppf: number): FadeHandle[] {
  if (!FADING.has(clip.component)) {
    return [];
  }
  const p = clip.props as Fades;
  const start = clip.from * ppf;
  const end = (clip.from + clip.durationInFrames) * ppf;
  return [
    { edge: FadeEdge.In, x: start + (p.fadeIn ?? 0) * fps * ppf },
    { edge: FadeEdge.Out, x: end - (p.fadeOut ?? 0) * fps * ppf }
  ];
}

const INSET: Record<FadeEdge, (clip: MotionClip, frame: number) => number> = {
  [FadeEdge.In]: (clip, frame) => frame - clip.from,
  [FadeEdge.Out]: (clip, frame) => clip.from + clip.durationInFrames - frame
};

export function dragFade(doc: MotionDoc, clipId: string, edge: FadeEdge, frame: number): OpResult {
  const clip = findClip(doc, clipId)?.clip;
  if (!clip) {
    return { ok: false, error: `no clip ${clipId}` };
  }
  const longest = Math.min(MAX_FADE_S, clip.durationInFrames / doc.fps / 2);
  const seconds = Math.max(0, Math.min(longest, INSET[edge](clip, frame) / doc.fps));
  return setProps(doc, clipId, {
    [edge]: Math.round(seconds * TENTHS) / TENTHS
  });
}
