import { findClip, type MotionClip, type MotionDoc } from '../doc';
import type { OpResult } from '../timeline';
import { EFFECTS, defaultValues, type EffectKind, type Values } from './registry';
import { EFFECT_PREFIX, MAX_EFFECTS, effectProblem, type Effect } from './model';

const fail = (error: string): OpResult => ({ ok: false, error });

function editEffects(doc: MotionDoc, clipId: string, edit: (clip: MotionClip) => MotionClip | string): OpResult {
  const found = findClip(doc, clipId);
  if (!found) {
    return fail(`no clip ${clipId}`);
  }
  const next = edit(found.clip);
  if (typeof next === 'string') {
    return fail(next);
  }
  return { ok: true, doc: { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === clipId ? next : c)) })) } };
}

export function addEffect(doc: MotionDoc, clipId: string, kind: EffectKind, id: string, params: Values = {}): OpResult {
  const effect: Effect = { id, kind, enabled: true, params: { ...defaultValues(kind), ...params } };
  return editEffects(doc, clipId, (clip) => {
    if (clip.effects.length >= MAX_EFFECTS) {
      return `a clip holds at most ${MAX_EFFECTS} effects`;
    }
    if (clip.effects.some((e) => e.id === id)) {
      return `effect ${id} already exists`;
    }
    return effectProblem(effect) ?? { ...clip, effects: [...clip.effects, effect] };
  });
}

export type EffectPatch = { params?: Values; enabled?: boolean; index?: number };

export function setEffect(doc: MotionDoc, clipId: string, effectId: string, patch: EffectPatch): OpResult {
  return editEffects(doc, clipId, (clip) => {
    const current = clip.effects.find((e) => e.id === effectId);
    if (!current) {
      return `no effect ${effectId} on ${clipId}; it has ${clip.effects.map((e) => `${e.id} (${EFFECTS[e.kind].label})`).join(', ') || 'none'}`;
    }
    const next: Effect = { ...current, enabled: patch.enabled ?? current.enabled, params: { ...current.params, ...patch.params } };
    const problem = effectProblem(next);
    if (problem) {
      return problem;
    }
    const rest = clip.effects.filter((e) => e.id !== effectId);
    const at = Math.min(Math.max(0, patch.index ?? clip.effects.indexOf(current)), rest.length);
    return { ...clip, effects: [...rest.slice(0, at), next, ...rest.slice(at)] };
  });
}

const ownedBy = (effectId: string) => (key: string) => key.startsWith(`${EFFECT_PREFIX}.${effectId}.`);

export function removeEffect(doc: MotionDoc, clipId: string, effectId: string): OpResult {
  return editEffects(doc, clipId, (clip) => {
    if (!clip.effects.some((e) => e.id === effectId)) {
      return `no effect ${effectId} on ${clipId}`;
    }
    const owned = ownedBy(effectId);
    return {
      ...clip,
      effects: clip.effects.filter((e) => e.id !== effectId),
      keyframes: Object.fromEntries(Object.entries(clip.keyframes).filter(([key]) => !owned(key))),
      expressions: Object.fromEntries(Object.entries(clip.expressions).filter(([key]) => !owned(key)))
    };
  });
}
