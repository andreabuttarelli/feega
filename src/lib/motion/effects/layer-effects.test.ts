import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, setKeyframes, type OpResult } from '../timeline';
import { Ease } from '../design';
import { EFFECTS, EFFECT_ALPHA, EffectKind, defaultValues, editedParams } from './registry';
import { addEffect } from './ops';
import { effectKey } from './model';
import { effectLayer, effectTimeline } from './render';

function ok(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const base = () => ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30 }, 'card'));
const clipOf = (doc: MotionDoc) => findClip(doc, 'card')!.clip;
const frame = { width: 1920, height: 1080, fps: 30 };
const plain = (c: string) => c;

describe('layer effects', () => {
  it('an inner shadow paints inside the layer alpha, offset and softened, over the layer', () => {
    const doc = ok(addEffect(base(), 'card', EffectKind.InnerShadow, 'in', { distance: 10, angle: 90, blur: 8, color: '#ff0000', opacity: 0.5 }));
    const html = effectLayer(clipOf(doc), frame, plain, '<i></i>');

    expect(html).toContain('filter:url(#ef-card-in)');
    expect(html).toMatch(/<feOffset[^>]*in="SourceAlpha"[^>]*dx="0"[^>]*dy="10"/);
    expect(html).toContain('operator="out"');
    expect(html).toMatch(/flood-color="#ff0000"[^>]*flood-opacity="0.5"/);
  });

  it('a background blur blurs what is behind the layer, not the layer', () => {
    const doc = ok(addEffect(base(), 'card', EffectKind.BackgroundBlur, 'bg', { radius: 12 }));
    const html = effectLayer(clipOf(doc), frame, plain, '<i></i>');

    expect(html).toContain('backdrop-filter:blur(12px)');
    expect(html).toContain('-webkit-backdrop-filter:blur(12px)');
    expect(html).not.toMatch(/[";]filter:blur/);
  });

  it('a hidden background blur leaves the layer as it was', () => {
    const doc = ok(addEffect(base(), 'card', EffectKind.BackgroundBlur, 'bg'));
    const hidden = { ...clipOf(doc), effects: clipOf(doc).effects.map((e) => ({ ...e, enabled: false })) };
    expect(effectLayer(hidden, frame, plain, '<i></i>')).toBe('<i></i>');
  });

  it('an animated background blur sets its radius frame by frame', () => {
    let doc = ok(addEffect(base(), 'card', EffectKind.BackgroundBlur, 'bg'));
    doc = ok(setKeyframes(doc, 'card', effectKey('bg', 'radius'), [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 29, value: 29, ease: Ease.Linear }]));
    const sets = effectTimeline(clipOf(doc), frame, plain);

    expect(sets.find((s) => s.vars.backdropFilter === 'blur(10px)')).toBeTruthy();
  });

  it('shadows and glow pair their colour with an alpha the colour field edits', () => {
    for (const [kind, pair] of Object.entries(EFFECT_ALPHA)) {
      const keys = EFFECTS[kind as EffectKind].params.map((p) => p.key);
      expect({ kind, ok: keys.includes(pair!.color) && keys.includes(pair!.alpha) }).toEqual({ kind, ok: true });
    }
    expect(Object.keys(EFFECT_ALPHA).sort()).toEqual([EffectKind.DropShadow, EffectKind.Glow, EffectKind.InnerShadow].sort());
  });

  it('a paired alpha is edited inside its colour, not as its own field', () => {
    expect(editedParams(EffectKind.DropShadow).map((p) => p.key)).toEqual(['distance', 'angle', 'blur', 'color']);
    expect(editedParams(EffectKind.GaussianBlur).map((p) => p.key)).toEqual(['radius']);
  });

  it('defaults: a soft black shadow and a 4px background blur', () => {
    expect(defaultValues(EffectKind.InnerShadow)).toMatchObject({ color: '#000000', opacity: 0.25 });
    expect(defaultValues(EffectKind.BackgroundBlur)).toEqual({ radius: 4 });
  });
});
