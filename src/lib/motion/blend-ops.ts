import { COMPONENTS, TrackKind } from './components';
import { findClip, type MotionDoc } from './doc';
import type { OpResult } from './timeline';
import type { BlendMode } from './blend';

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
