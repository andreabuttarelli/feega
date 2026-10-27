import type { MotionClip, MotionDoc } from './doc';

function withoutMuted(clip: MotionClip): MotionClip {
  if (!clip.mutedLanes?.length) {
    return clip;
  }
  const muted = new Set(clip.mutedLanes);
  return { ...clip, keyframes: Object.fromEntries(Object.entries(clip.keyframes).filter(([prop]) => !muted.has(prop))) };
}

export function withoutMutedLanes(doc: MotionDoc): MotionDoc {
  const anyMuted = doc.tracks.some((t) => t.clips.some((c) => (c as MotionClip).mutedLanes?.length));
  if (!anyMuted) {
    return doc;
  }
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => withoutMuted(c as MotionClip)) })) } as MotionDoc;
}
