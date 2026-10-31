import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, findClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, setProps } from '@feega/motion-core/motion/timeline';
import { StyleKind, applyStyle, defineStyle } from './styles';
import { overridesOf, resetOverride } from './style-overrides';

const HEADLINE = { kind: StyleKind.Text, size: 0.2, weight: 600, color: '#ff0000' } as const;

function ok(r: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

function styled(): MotionDoc {
  const a = ok(addClip(newMotionDoc(MotionFormat.Square), { component: 'Text', from: 0, props: {} }, 't1'));
  const b = ok(addClip(a, { component: 'Text', from: 0, props: {} }, 't2'));
  return ok(applyStyle(ok(defineStyle(b, 'Headline', HEADLINE)), ['t1', 't2'], 'Headline'));
}

const clip = (doc: MotionDoc, id: string) => findClip(doc, id)!.clip;

describe('per-property overrides of a style', () => {
  it('a clip that follows its style has no overrides', () => {
    expect(overridesOf(styled(), 't1')).toEqual([]);
  });

  it('changing the size of a styled text keeps it linked and marks size overridden', () => {
    const doc = ok(setProps(styled(), 't1', { size: 0.5 }));

    expect(clip(doc, 't1').styleRef).toBe('Headline');
    expect(overridesOf(doc, 't1')).toEqual(['size']);
  });

  it('a style edit reaches the props a clip did not override, and leaves the override', () => {
    const doc = ok(setProps(styled(), 't1', { size: 0.5 }));
    const edited = ok(defineStyle(doc, 'Headline', { ...HEADLINE, size: 0.3, weight: 800 }));

    expect(clip(edited, 't1').props).toMatchObject({ size: 0.5, weight: 800 });
    expect(clip(edited, 't2').props).toMatchObject({ size: 0.3, weight: 800 });
  });

  it('reset puts an overridden prop back on the style, which it then follows', () => {
    const reset = ok(resetOverride(ok(setProps(styled(), 't1', { size: 0.5 })), 't1', 'size'));

    expect(clip(reset, 't1').props.size).toBe(0.2);
    expect(overridesOf(reset, 't1')).toEqual([]);
    expect(clip(ok(defineStyle(reset, 'Headline', { ...HEADLINE, size: 0.3 })), 't1').props.size).toBe(0.3);
  });

  it('an unstyled clip has no overrides and nothing to reset', () => {
    const doc = ok(addClip(newMotionDoc(MotionFormat.Square), { component: 'Text', from: 0, props: {} }, 't1'));

    expect(overridesOf(doc, 't1')).toEqual([]);
    expect(resetOverride(doc, 't1', 'size').ok).toBe(false);
  });
});
