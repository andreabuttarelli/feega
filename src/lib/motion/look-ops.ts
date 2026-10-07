import { byFrame, type DocVerdict, type MotionDoc } from './doc';
import type { Keyframe } from './keyframes';
import { lightSchema, lookSchema, newLook, type Light, type LightKey, type Look } from './look';

export type LightPatch = Partial<Omit<Light, 'id' | 'keyframes'>>;
export type LookPatch = Partial<Pick<Look, 'softShadows' | 'contactShadow'>> & { environment?: Partial<Look['environment']> };

function withLook(doc: MotionDoc, look: Look): DocVerdict {
  const parsed = lookSchema.safeParse(look);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }
  return { ok: true, doc: { ...doc, look: parsed.data } };
}

export function setLook(doc: MotionDoc, patch: LookPatch): DocVerdict {
  const look = doc.look ?? newLook();
  return withLook(doc, { ...look, ...patch, environment: { ...look.environment, ...patch.environment } });
}

export function removeLook(doc: MotionDoc): DocVerdict {
  return { ok: true, doc: { ...doc, look: null } };
}

export function setLight(doc: MotionDoc, id: string, patch: LightPatch): DocVerdict {
  const look = doc.look ?? newLook();
  const current = look.lights.find((l) => l.id === id);
  if (!current && !patch.kind) {
    return { ok: false, error: `no light ${id}: give a kind to add it` };
  }
  const light = { ...(current ?? lightSchema.parse({ id, kind: patch.kind })), ...patch };
  const lights = current ? look.lights.map((l) => (l.id === id ? light : l)) : [...look.lights, light];
  return withLook(doc, { ...look, lights });
}

export function removeLight(doc: MotionDoc, id: string): DocVerdict {
  if (!doc.look?.lights.some((l) => l.id === id)) {
    return { ok: false, error: `no light ${id}` };
  }
  return withLook(doc, { ...doc.look, lights: doc.look.lights.filter((l) => l.id !== id) });
}

export function setLightKeyframes(doc: MotionDoc, id: string, key: LightKey, track: Keyframe[]): DocVerdict {
  const light = doc.look?.lights.find((l) => l.id === id);
  if (!doc.look || !light) {
    return { ok: false, error: `no light ${id}` };
  }
  const next = byFrame(track.map((k) => ({ ...k, frame: Math.max(0, Math.round(k.frame)) })));
  const keyframes = { ...light.keyframes, [key]: next };
  if (!next.length) {
    delete keyframes[key];
  }
  return withLook(doc, { ...doc.look, lights: doc.look.lights.map((l) => (l.id === id ? { ...light, keyframes } : l)) });
}
