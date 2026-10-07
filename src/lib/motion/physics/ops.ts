import { COMPONENTS, TrackKind } from '../components';
import { findClip, type DocVerdict, type MotionDoc } from '../doc';
import { PHYSICS_PRESET, physicsSchema, type Physics, type PhysicsPreset } from './model';

const fail = (error: string): DocVerdict => ({ ok: false, error });

export function setPhysics(doc: MotionDoc, clipId: string, patch: Partial<Physics> | null): DocVerdict {
  const found = findClip(doc, clipId);
  if (!found) {
    return fail(`no clip ${clipId}`);
  }
  if (COMPONENTS[found.clip.component].track !== TrackKind.Visual) {
    return fail(`${clipId} is ${found.clip.component}: only visual clips take physics`);
  }

  const parsed = patch === null ? null : physicsSchema.safeParse({ ...found.clip.physics, ...patch });
  if (parsed && !parsed.success) {
    return fail(`physics: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
  }

  const clip = { ...found.clip, physics: parsed ? parsed.data : null };
  return { ok: true, doc: { ...doc, tracks: doc.tracks.map((t) => (t.id === found.track.id ? { ...t, clips: t.clips.map((c) => (c.id === clipId ? clip : c)) } : t)) } };
}

export function applyPhysicsPreset(doc: MotionDoc, clipId: string, preset: PhysicsPreset): DocVerdict {
  return setPhysics(doc, clipId, PHYSICS_PRESET[preset].physics);
}
