import { Ease } from '../design';
import { findClip, type MotionDoc } from '../doc';
import { setKeyframes, setProps, type OpResult } from '../timeline';
import { ModifierKind, type Values } from './modifiers';
import { modifierKey, type Modifier } from './schema';
import { removeModifier } from './ops';

export enum ShapePreset {
  Blob = 'blob',
  Ripple = 'ripple',
  Liquid = 'liquid'
}

export const SHAPE_PRESETS = Object.values(ShapePreset) as [ShapePreset, ...ShapePreset[]];

type Step = { kind: ModifierKind; params: Values };
type Sway = { step: number; param: string; rest: number; peak: number };
type Spec = { label: string; about: string; steps: readonly Step[]; sway?: Sway };

export const PRESET: Record<ShapePreset, Spec> = {
  [ShapePreset.Blob]: {
    label: 'Blob',
    about: 'the outline swells and breathes like a living drop, by itself',
    steps: [{ kind: ModifierKind.Blob, params: { amount: 0.06, lobes: 4, speed: 0.4 } }]
  },
  [ShapePreset.Ripple]: {
    label: 'Ripple',
    about: 'waves run around the edge',
    steps: [{ kind: ModifierKind.Wave, params: { amplitude: 0.012, waves: 10, speed: 1 } }]
  },
  [ShapePreset.Liquid]: {
    label: 'Liquid',
    about: 'three drops drift apart and melt back into one',
    steps: [
      { kind: ModifierKind.Blob, params: { amount: 0.05, lobes: 3, speed: 0.5 } },
      { kind: ModifierKind.Repeater, params: { copies: 3, offsetX: 0, offsetY: 0, rotation: 0, scale: 0.75 } },
      { kind: ModifierKind.Goo, params: { blur: 0.02, threshold: 0.5 } }
    ],
    sway: { step: 1, param: 'offsetX', rest: 0, peak: 1.2 }
  }
};

const fail = (error: string): OpResult => ({ ok: false, error });

function cleared(doc: MotionDoc, clipId: string): OpResult {
  const modifiers = (findClip(doc, clipId)?.clip.props.modifiers as Modifier[] | undefined) ?? [];
  return modifiers.reduce<OpResult>((r, m) => (r.ok ? removeModifier(r.doc, clipId, m.id) : r), { ok: true, doc });
}

export function applyShapePreset(doc: MotionDoc, clipId: string, preset: ShapePreset, newId: () => string): OpResult {
  const clip = findClip(doc, clipId)?.clip;
  if (!clip) {
    return fail(`no clip ${clipId}`);
  }
  if (clip.component !== 'Shape') {
    return fail(`${clipId} is a ${clip.component}, not a Shape`);
  }

  const spec = PRESET[preset];
  const modifiers = spec.steps.map((s) => ({ id: newId(), kind: s.kind, enabled: true, params: s.params }));
  const empty = cleared(doc, clipId);
  const placed = empty.ok ? setProps(empty.doc, clipId, { modifiers }) : empty;
  if (!placed.ok || !spec.sway) {
    return placed;
  }

  const { step, param, rest, peak } = spec.sway;
  const last = clip.durationInFrames - 1;
  const keys = [
    { frame: 0, value: rest, ease: Ease.Standard },
    { frame: Math.round(last / 2), value: peak, ease: Ease.Standard },
    { frame: last, value: rest, ease: Ease.Standard }
  ];
  return setKeyframes(placed.doc, clipId, modifierKey(modifiers[step].id, param), keys);
}
