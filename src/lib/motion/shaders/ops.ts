import { findClip, type MotionClip, type MotionDoc } from '../doc';
import type { OpResult } from '../timeline';
import { EFFECT_PREFIX } from '../effects/model';
import { clipShadersProblem, MAX_SHADERS_PER_CLIP, shaderValues, type ClipShader, type ShaderSnapshot } from './model';

type Values = Record<string, number | string>;

const fail = (error: string): OpResult => ({ ok: false, error });

function editShaders(doc: MotionDoc, clipId: string, edit: (clip: MotionClip) => MotionClip | string): OpResult {
  const found = findClip(doc, clipId);
  if (!found) {
    return fail(`no clip ${clipId}`);
  }

  const next = edit(found.clip);
  if (typeof next === 'string') {
    return fail(next);
  }

  const problem = clipShadersProblem(next.component, next.shaders, doc.shaders);
  if (problem) {
    return fail(problem);
  }

  return { ok: true, doc: { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === clipId ? next : c)) })) } };
}

export type ShaderSource = { ref: string; snapshot: ShaderSnapshot };

export function addShader(doc: MotionDoc, clipId: string, id: string, source: ShaderSource, params: Values = {}): OpResult {
  const withDef = { ...doc, shaders: { ...doc.shaders, [source.ref]: source.snapshot } };
  return editShaders(withDef, clipId, (clip) => {
    if (clip.shaders.length >= MAX_SHADERS_PER_CLIP) {
      return `a clip holds at most ${MAX_SHADERS_PER_CLIP} custom effect`;
    }

    const shader: ClipShader = { id, ref: source.ref, enabled: true, params };
    return { ...clip, shaders: [...clip.shaders, { ...shader, params: shaderValues(shader, source.snapshot) }] };
  });
}

export type ShaderPatch = { params?: Values; enabled?: boolean };

export function setShader(doc: MotionDoc, clipId: string, id: string, patch: ShaderPatch): OpResult {
  return editShaders(doc, clipId, (clip) => {
    const current = clip.shaders.find((s) => s.id === id);
    if (!current) {
      return `no custom effect ${id} on ${clipId}`;
    }

    const next = { ...current, enabled: patch.enabled ?? current.enabled, params: { ...current.params, ...patch.params } };
    return { ...clip, shaders: clip.shaders.map((s) => (s.id === id ? next : s)) };
  });
}

export function removeShader(doc: MotionDoc, clipId: string, id: string): OpResult {
  return editShaders(doc, clipId, (clip) => {
    if (!clip.shaders.some((s) => s.id === id)) {
      return `no custom effect ${id} on ${clipId}`;
    }

    const owned = (key: string) => key.startsWith(`${EFFECT_PREFIX}.${id}.`);
    return {
      ...clip,
      shaders: clip.shaders.filter((s) => s.id !== id),
      keyframes: Object.fromEntries(Object.entries(clip.keyframes).filter(([key]) => !owned(key))),
      expressions: Object.fromEntries(Object.entries(clip.expressions).filter(([key]) => !owned(key)))
    };
  });
}
