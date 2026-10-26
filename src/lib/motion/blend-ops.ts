import { COMPONENTS, TrackKind } from '@feega/motion-core/motion/components';
import { findClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import type { BlendMode } from '@feega/motion-core/motion/blend';

export function setBlendMode(doc: MotionDoc, clipId: string, mode: BlendMode): OpResult {
  const found = findClip(doc, clipId);
  if (!found) {
    return { ok: false, error: `no clip ${clipId}` };
  }
  if (COMPONENTS[found.clip.component].track !== TrackKind.Visual) {
    return { ok: false, error: `${clipId} is audio: only visual clips blend` };
  }
  return { ok: true, doc: { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, blend: mode } : c)) })) } };
}
