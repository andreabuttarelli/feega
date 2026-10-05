import { Ease } from '../design';
import { findClip, type MotionDoc } from '../doc';
import { setKeyframes, setProps, type OpResult } from '../timeline';
import { pathData } from './geometry';
import type { ModifierKind } from './modifiers';
import { baseOutline, type ShapeLook } from './render';
import { MAX_MODIFIERS, MAX_MORPHS, MODIFIER_PREFIX, ShapeKind, type Modifier } from './schema';

const fail = (error: string): OpResult => ({ ok: false, error });
const UNIT_BOX = { w: 1, h: 1 };

export type ShapeParams = Pick<ShapeLook, 'shape' | 'roundness' | 'sides' | 'points' | 'innerRadius'> & { path?: string };

export function shapePath(p: ShapeParams): string {
  return pathData(baseOutline({ path: '', ...p } as ShapeLook, UNIT_BOX));
}

function shapeProps(doc: MotionDoc, clipId: string): Record<string, unknown> | string {
  const found = findClip(doc, clipId);
  if (!found) {
    return `no clip ${clipId}`;
  }
  return found.clip.component === 'Shape' ? found.clip.props : `${clipId} is a ${found.clip.component}, not a Shape`;
}

export function setPath(doc: MotionDoc, clipId: string, path: string): OpResult {
  const props = shapeProps(doc, clipId);
  return typeof props === 'string' ? fail(props) : setProps(doc, clipId, { shape: ShapeKind.Path, path });
}

export type MorphTarget = { path?: string; kind?: ShapeKind; roundness?: number; sides?: number; points?: number; innerRadius?: number; from?: number; to?: number };

export function morphTo(doc: MotionDoc, clipId: string, target: MorphTarget): OpResult {
  const props = shapeProps(doc, clipId);
  if (typeof props === 'string') {
    return fail(props);
  }
  const morphs = (props.morphs as string[]) ?? [];
  if (morphs.length >= MAX_MORPHS) {
    return fail(`a shape morphs through at most ${MAX_MORPHS} targets`);
  }
  const look = props as unknown as ShapeLook;
  const path = target.path ?? shapePath({ shape: target.kind ?? look.shape, roundness: target.roundness ?? look.roundness, sides: target.sides ?? look.sides, points: target.points ?? look.points, innerRadius: target.innerRadius ?? look.innerRadius, path: look.path });
  const added = setProps(doc, clipId, { morphs: [...morphs, path] });
  if (!added.ok || target.from === undefined || target.to === undefined) {
    return added;
  }
  const clip = findClip(added.doc, clipId)!.clip;
  const kept = (clip.keyframes.morph ?? []).filter((k) => k.frame <= target.from!);
  const start = kept.some((k) => k.frame === target.from) ? [] : [{ frame: Math.round(target.from), value: morphs.length, ease: Ease.Standard }];
  return setKeyframes(added.doc, clipId, 'morph', [...kept, ...start, { frame: Math.round(target.to), value: morphs.length + 1, ease: Ease.Standard }]);
}

const MORPH_SECONDS = 1;

export function morphHere(doc: MotionDoc, clipId: string, kind: ShapeKind, frame: number): OpResult {
  const clip = findClip(doc, clipId)?.clip;
  if (!clip) {
    return fail(`no clip ${clipId}`);
  }
  const last = clip.durationInFrames - 1;
  const from = Math.min(Math.max(frame - clip.from, 0), Math.max(last - 1, 0));
  return morphTo(doc, clipId, { kind, from, to: Math.min(from + MORPH_SECONDS * doc.fps, last) });
}

function modifiersOf(doc: MotionDoc, clipId: string): Modifier[] | string {
  const props = shapeProps(doc, clipId);
  return typeof props === 'string' ? props : ((props.modifiers as Modifier[]) ?? []);
}

export function addModifier(doc: MotionDoc, clipId: string, kind: ModifierKind, id: string, params: Record<string, number> = {}): OpResult {
  const modifiers = modifiersOf(doc, clipId);
  if (typeof modifiers === 'string') {
    return fail(modifiers);
  }
  if (modifiers.length >= MAX_MODIFIERS) {
    return fail(`a shape holds at most ${MAX_MODIFIERS} modifiers`);
  }
  return setProps(doc, clipId, { modifiers: [...modifiers, { id, kind, enabled: true, params }] });
}

export type ModifierPatch = { params?: Record<string, number>; enabled?: boolean; index?: number };

export function setModifier(doc: MotionDoc, clipId: string, id: string, patch: ModifierPatch): OpResult {
  const modifiers = modifiersOf(doc, clipId);
  if (typeof modifiers === 'string') {
    return fail(modifiers);
  }
  const current = modifiers.find((m) => m.id === id);
  if (!current) {
    return fail(`no modifier ${id} on ${clipId}; it has ${modifiers.map((m) => `${m.id} (${m.kind})`).join(', ') || 'none'}`);
  }
  const next = { ...current, enabled: patch.enabled ?? current.enabled, params: { ...current.params, ...patch.params } };
  const rest = modifiers.filter((m) => m.id !== id);
  const at = Math.min(Math.max(0, patch.index ?? modifiers.indexOf(current)), rest.length);
  return setProps(doc, clipId, { modifiers: [...rest.slice(0, at), next, ...rest.slice(at)] });
}

export function removeModifier(doc: MotionDoc, clipId: string, id: string): OpResult {
  const modifiers = modifiersOf(doc, clipId);
  if (typeof modifiers === 'string') {
    return fail(modifiers);
  }
  if (!modifiers.some((m) => m.id === id)) {
    return fail(`no modifier ${id} on ${clipId}`);
  }
  const removed = setProps(doc, clipId, { modifiers: modifiers.filter((m) => m.id !== id) });
  if (!removed.ok) {
    return removed;
  }
  const owned = (key: string) => key.startsWith(`${MODIFIER_PREFIX}.${id}.`);
  return {
    ok: true,
    doc: {
      ...removed.doc,
      tracks: removed.doc.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => (c.id === clipId ? { ...c, keyframes: Object.fromEntries(Object.entries(c.keyframes).filter(([k]) => !owned(k))), expressions: Object.fromEntries(Object.entries(c.expressions ?? {}).filter(([k]) => !owned(k))) } : c))
      }))
    }
  };
}
