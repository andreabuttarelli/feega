import { findClip, type MotionDoc } from './doc';
import { motionBlurSchema, type MotionBlur } from './motion-blur';
import type { OpResult } from './timeline';

export function setMotionBlur(doc: MotionDoc, patch: Partial<MotionBlur>): OpResult {
  const parsed = motionBlurSchema.safeParse({ ...doc.motionBlur, ...patch });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }
  return { ok: true, doc: { ...doc, motionBlur: parsed.data } };
}

export function setClipsBlur(doc: MotionDoc, clipIds: string[], blurred: boolean): OpResult {
  const missing = clipIds.find((id) => !findClip(doc, id));
  if (missing) {
    return { ok: false, error: `no clip ${missing}` };
  }
  const chosen = new Set(clipIds);
  return { ok: true, doc: { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (chosen.has(c.id) ? { ...c, motionBlur: blurred } : c)) })) } };
}
