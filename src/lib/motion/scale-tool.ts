import { findClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import type { Transform } from '@feega/motion-core/motion/keyframes';
import { transformAt } from '@feega/motion-core/motion/parent';
import { anchorOf, type Pt } from './scene-select';
import { setProps, type OpResult } from '@feega/motion-core/motion/timeline';
import { setEffect } from './effects/ops';
import { EFFECTS, EffectKind } from '@feega/motion-core/motion/effects/registry';
import type { Effect } from '@feega/motion-core/motion/effects/model';

export enum ScaleMode {
  Resize = 'resize',
  Scale = 'scale'
}

type Props = Record<string, unknown>;
type Scaler = (value: unknown, factor: number) => unknown;

const times: Scaler = (value, factor) => (typeof value === 'number' ? value * factor : value);

const strokes: Scaler = (value, factor) =>
  Array.isArray(value) ? value.map((s: Props) => ({ ...s, width: times(s.width, factor), ...(Array.isArray(s.sides) ? { sides: s.sides.map((w: unknown) => times(w, factor)) } : {}) })) : value;

const SCALED: Record<string, Scaler> = {
  width: times,
  height: times,
  size: times,
  strokes
};

const PIXEL_PARAMS: Partial<Record<EffectKind, readonly string[]>> = {
  [EffectKind.GaussianBlur]: ['radius'],
  [EffectKind.DirectionalBlur]: ['length'],
  [EffectKind.ProgressiveBlur]: ['startRadius', 'endRadius'],
  [EffectKind.DropShadow]: ['distance', 'x', 'y', 'blur', 'spread'],
  [EffectKind.InnerShadow]: ['distance', 'blur'],
  [EffectKind.BackgroundBlur]: ['radius'],
  [EffectKind.Glow]: ['radius'],
  [EffectKind.Stroke]: ['width'],
  [EffectKind.ChromaticAberration]: ['offset'],
  [EffectKind.Wave]: ['amount', 'scale', 'speed']
};

const TINY = 1e-6;

function scaledParams(effect: Effect, factor: number): Record<string, number> {
  const specs = EFFECTS[effect.kind].params;
  const patch: Record<string, number> = {};
  for (const key of PIXEL_PARAMS[effect.kind] ?? []) {
    const spec = specs.find((p) => p.key === key)!;
    const current = Number(effect.params[key] ?? spec.fallback);
    patch[key] = Math.min(spec.max, Math.max(spec.min, current * factor));
  }
  return patch;
}

function scaleEffects(doc: MotionDoc, id: string, factor: number): OpResult {
  let result: OpResult = { ok: true, doc };
  for (const effect of findClip(doc, id)?.clip.effects ?? []) {
    if (!result.ok) {
      return result;
    }
    result = setEffect(result.doc, id, effect.id, { params: scaledParams(effect, factor) });
  }
  return result;
}

export const flipScale = (mode: ScaleMode): ScaleMode => (mode === ScaleMode.Scale ? ScaleMode.Resize : ScaleMode.Scale);

function scaledProps(props: Props, factor: number, origin: Pt, frame: { width: number; height: number }): Props {
  const patch: Props = {};
  for (const [key, scale] of Object.entries(SCALED)) {
    if (key in props) {
      patch[key] = scale(props[key], factor);
    }
  }
  if (typeof props.x === 'number' && typeof props.y === 'number') {
    patch.x = (origin[0] + (props.x * frame.width - origin[0]) * factor) / frame.width;
    patch.y = (origin[1] + (props.y * frame.height - origin[1]) * factor) / frame.height;
  }
  return patch;
}

export function scaleClips(doc: MotionDoc, ids: readonly string[], factor: number, origin: Pt): OpResult {
  if (!(factor > TINY) || !Number.isFinite(factor)) {
    return { ok: false, error: 'the scale factor must be a positive number' };
  }
  let result: OpResult = { ok: true, doc };
  for (const id of ids) {
    if (!result.ok) {
      return result;
    }
    const clip = findClip(result.doc, id)?.clip;
    if (!clip) {
      return { ok: false, error: `no clip ${id}` };
    }
    result = setProps(result.doc, id, scaledProps(clip.props, factor, origin, doc));
    if (result.ok) {
      result = scaleEffects(result.doc, id, factor);
    }
  }
  return result;
}

export function bakeScale(doc: MotionDoc, clipId: string, frame: number, patch: Transform): OpResult {
  const clip = findClip(doc, clipId)?.clip;
  if (!clip) {
    return { ok: false, error: `no clip ${clipId}` };
  }
  const key = patch.scaleX !== undefined ? 'scaleX' : 'scaleY';
  const factor = (patch[key] ?? 1) / transformAt(clip, key, frame);
  return scaleClips(doc, [clipId], factor, anchorOf(doc, clipId, frame));
}
